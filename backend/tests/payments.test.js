'use strict';

const { setupDatabase, closeDatabase } = require('./helpers/db');
const { request, app, login, auth } = require('./helpers/session');
const { models } = require('../src/models');
const { today, addDays } = require('../src/shared/utils/dates');
const { DemoGateway } = require('../src/infrastructure/payments/demo.gateway');
const { getGateway } = require('../src/infrastructure/payments');

jest.setTimeout(60000);

describe('payments, commissions, payouts and refunds', () => {
  const gateway = new DemoGateway();
  let customer;
  let hotel;
  let transport;
  let guide;
  let admin;
  let booking;
  let payment;
  let half;

  beforeAll(async () => {
    await setupDatabase();
    customer = await login('customer@pothik.test', 'PothikDemo123');
    hotel = await login('hotel.owner@pothik.test', 'PothikDemo123');
    transport = await login('transport@pothik.test', 'PothikDemo123');
    guide = await login('guide@pothik.test', 'PothikDemo123');
    admin = await login('admin@pothik.test', process.env.ADMIN_PASSWORD);

    const checkIn = addDays(today(), 61);
    const checkOut = addDays(today(), 63);
    const hotels = await request(app).get('/api/v1/hotels');
    const hotelSlug = hotels.body.data.items.find((row) => row.slug === 'sea-crown-hotel-resort').slug;
    const detail = (await request(app).get(`/api/v1/hotels/${hotelSlug}`)).body.data;
    const deluxe = detail.rooms.find((room) => room.name === 'Deluxe Sea View');
    const microbus = (await request(app).get('/api/v1/vehicles').query({ search: 'Microbus' })).body.data.items[0];
    const guideRow = (await request(app).get('/api/v1/guides')).body.data.items[0];

    const created = await request(app)
      .post('/api/v1/bookings')
      .set(auth(customer.accessToken))
      .send({
        type: 'CUSTOM_TRIP',
        composition: {
          adults: 2,
          hotel: { hotelId: detail.id, checkIn, checkOut, rooms: [{ roomId: deluxe.id, units: 1 }] },
          transport: { vehicleId: microbus.id, startDate: checkIn, endDate: checkOut },
          guide: { guideId: guideRow.id, startDate: checkIn, endDate: addDays(checkIn, 1) },
        },
        contact: { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' },
      });
    expect(created.status).toBe(201);
    booking = created.body.data;

    for (const session of [hotel, transport, guide]) {
      const accepted = await request(app)
        .post(`/api/v1/provider/bookings/${booking.reference}/accept`)
        .set(auth(session.accessToken));
      expect(accepted.status).toBe(200);
    }

    const payable = await request(app).get(`/api/v1/bookings/${booking.reference}`).set(auth(customer.accessToken));
    expect(payable.body.data.status).toBe('AWAITING_PAYMENT');
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('initiates a payment with an idempotency key and reuses the replay', async () => {
    const halfAmount = (Number(booking.totalAmount) / 2).toFixed(2);
    const payload = { bookingReference: booking.reference, amount: halfAmount, method: 'bkash', idempotencyKey: 'jest-pay-part-1' };

    const first = await request(app).post('/api/v1/payments').set(auth(customer.accessToken)).send(payload);
    expect(first.status).toBe(201);
    expect(first.body.data.payment.status).toBe('PENDING');
    expect(String(first.body.data.gatewayUrl)).toContain('/pay/demo/');

    const replay = await request(app).post('/api/v1/payments').set(auth(customer.accessToken)).send(payload);
    expect(replay.status).toBe(201);
    expect(replay.body.data.payment.id).toBe(first.body.data.payment.id);
    expect(replay.body.data.idempotent).toBe(true);

    const conflict = await request(app)
      .post('/api/v1/payments')
      .set(auth(customer.accessToken))
      .send({ ...payload, amount: '10.00' });
    expect(conflict.status).toBe(409);

    const overpay = await request(app)
      .post('/api/v1/payments')
      .set(auth(customer.accessToken))
      .send({ bookingReference: booking.reference, amount: String(Number(booking.totalAmount) + 100), method: 'card', idempotencyKey: 'jest-pay-too-much' });
    expect(overpay.status).toBe(400);
    expect(overpay.body.code).toBe('PAYMENT_EXCEEDS_DUE');

    payment = first.body.data.payment;
    half = halfAmount;
  });

  it('rejects forged callbacks and cross-user settlement', async () => {
    const forged = await request(app).post('/api/v1/payments/callback/demo').send({
      paymentId: payment.id,
      amount: half,
      bookingReference: booking.reference,
      result: 'SUCCESS',
      signature: 'deadbeef',
    });
    expect(forged.status).toBe(400);
    expect(forged.body.code).toBe('PAYMENT_VERIFICATION_FAILED');

    const otherUser = await request(app)
      .post(`/api/v1/payments/${payment.id}/demo-complete`)
      .set(auth(hotel.accessToken));
    expect(otherUser.status).toBe(403);
  });

  it('accepts only gateway-signed callbacks and settles idempotently', async () => {
    const callback = gateway.buildCallback({
      paymentId: payment.id,
      amount: payment.amount,
      bookingReference: booking.reference,
      result: 'SUCCESS',
    });

    const settled = await request(app).post('/api/v1/payments/callback/demo').send(callback);
    expect(settled.status).toBe(200);
    expect(settled.body.data.settled).toBe(true);
    expect(settled.body.data.bookingStatus).toBe('AWAITING_PAYMENT');

    const duplicate = await request(app).post('/api/v1/payments/callback/demo').send(callback);
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.data.alreadySettled).toBe(true);

    const afterPartial = await request(app).get(`/api/v1/bookings/${booking.reference}`).set(auth(customer.accessToken));
    expect(Number(afterPartial.body.data.paidAmount)).toBe(Number(half));
    expect(afterPartial.body.data.status).toBe('AWAITING_PAYMENT');
  });

  it('advertises the configured payment gateways', async () => {
    const response = await request(app).get('/api/v1/payments/gateways');
    expect(response.status).toBe(200);
    expect(response.body.data.default).toBe('demo');
    const names = response.body.data.items.map((row) => row.name);
    expect(names).toEqual(expect.arrayContaining(['demo', 'sslcommerz', 'bkash']));
    expect(response.body.data.items.find((row) => row.name === 'bkash').configured).toBe(false);
  });

  it('settles a bKash session through the browser return and re-verification', async () => {
    const bkash = getGateway('bkash');
    const configured = jest.spyOn(bkash, 'assertConfigured').mockImplementation(() => {});
    const create = jest.spyOn(bkash, 'createSession').mockResolvedValue({
      gatewayUrl: 'https://sandbox.bka.sh/pay/BKSHTRX001',
      providerTxnId: 'BKSHTRX001',
      raw: { paymentID: 'BKSHTRX001' },
    });
    const execute = jest.spyOn(bkash, 'execute').mockImplementation(async (paymentID) => ({
      paymentID,
      transactionStatus: 'Completed',
      amount: '1.00',
      merchantInvoiceNumber: booking.reference,
      trxID: 'WALLETTRX1',
    }));

    try {
      const initiated = await request(app)
        .post('/api/v1/payments')
        .set(auth(customer.accessToken))
        .send({ bookingReference: booking.reference, amount: '1.00', method: 'bkash', gateway: 'bkash', idempotencyKey: 'jest-bkash-1' });

      expect(initiated.status).toBe(201);
      expect(initiated.body.data.payment.provider).toBe('bkash');
      expect(initiated.body.data.payment.status).toBe('PENDING');
      expect(initiated.body.data.payment.providerTxnId).toBe('BKSHTRX001');
      expect(initiated.body.data.gatewayUrl).toBe('https://sandbox.bka.sh/pay/BKSHTRX001');
      expect(create).toHaveBeenCalledTimes(1);

      const returned = await request(app)
        .get('/api/v1/payments/callback/bkash')
        .query({ paymentID: 'BKSHTRX001', status: 'success' });

      expect(returned.status).toBe(303);
      expect(returned.headers.location).toContain(`/account/bookings/${booking.reference}`);
      expect(returned.headers.location).toContain('payment=success');
      expect(execute).toHaveBeenCalledWith('BKSHTRX001');

      const detail = await request(app).get(`/api/v1/payments/${initiated.body.data.payment.id}`).set(auth(customer.accessToken));
      expect(detail.body.data.status).toBe('SUCCEEDED');
      expect(detail.body.data.providerTxnId).toBe('BKSHTRX001');

      const replay = await request(app)
        .get('/api/v1/payments/callback/bkash')
        .query({ paymentID: 'BKSHTRX001', status: 'success' });
      expect(replay.status).toBe(303);
    } finally {
      configured.mockRestore();
      create.mockRestore();
      execute.mockRestore();
    }
  });

  it('collects the remaining balance and confirms the booking', async () => {    const current = await request(app).get(`/api/v1/bookings/${booking.reference}`).set(auth(customer.accessToken));

    const remainder = await request(app)
      .post('/api/v1/payments')
      .set(auth(customer.accessToken))
      .send({ bookingReference: booking.reference, method: 'card', idempotencyKey: 'jest-pay-part-2' });
    expect(remainder.status).toBe(201);
    expect(Number(remainder.body.data.payment.amount)).toBe(Number(current.body.data.dueAmount));

    const finish = await request(app)
      .post(`/api/v1/payments/${remainder.body.data.payment.id}/demo-complete`)
      .set(auth(customer.accessToken));
    expect(finish.status).toBe(200);
    expect(finish.body.data.bookingStatus).toBe('CONFIRMED');

    const paid = await request(app).get(`/api/v1/bookings/${booking.reference}`).set(auth(customer.accessToken));
    expect(paid.body.data.dueAmount).toBe('0.00');
  });

  it('marks provider commissions as earned', async () => {
    const commissions = await request(app).get('/api/v1/provider/commissions').set(auth(hotel.accessToken));
    expect(commissions.status).toBe(200);
    expect(commissions.body.data.items.some((row) => row.status === 'EARNED')).toBe(true);
  });

  it('completes the trip and lets the provider withdraw earnings', async () => {
    const started = await request(app).post(`/api/v1/provider/bookings/${booking.reference}/start`).set(auth(hotel.accessToken));
    expect(started.body.data.status).toBe('IN_PROGRESS');

    const completed = await request(app).post(`/api/v1/provider/bookings/${booking.reference}/complete`).set(auth(hotel.accessToken));
    expect(completed.body.data.status).toBe('COMPLETED');

    const finance = await request(app).get('/api/v1/provider/finance').set(auth(hotel.accessToken));
    expect(finance.status).toBe(200);
    expect(Number(finance.body.data.earned)).toBeGreaterThan(0);

    const payout = await request(app)
      .post('/api/v1/provider/payouts')
      .set(auth(hotel.accessToken))
      .send({ amount: '1000.00', method: 'bkash', notes: 'Jest payout' });
    expect(payout.status).toBe(201);
    expect(payout.body.data.status).toBe('REQUESTED');

    const excessive = await request(app)
      .post('/api/v1/provider/payouts')
      .set(auth(hotel.accessToken))
      .send({ amount: '99999999.00', method: 'bkash' });
    expect(excessive.status).toBe(400);
    expect(excessive.body.code).toBe('PAYOUT_EXCEEDS_BALANCE');

    const queue = await request(app).get('/api/v1/admin/payouts').set(auth(admin.accessToken));
    expect(queue.status).toBe(200);
    expect(queue.body.data.items.length).toBeGreaterThan(0);

    const approved = await request(app)
      .post(`/api/v1/admin/payouts/${payout.body.data.id}/approve`)
      .set(auth(admin.accessToken))
      .send({});
    expect(approved.body.data.status).toBe('APPROVED');

    const paid = await request(app)
      .post(`/api/v1/admin/payouts/${payout.body.data.id}/paid`)
      .set(auth(admin.accessToken))
      .send({ reference: 'BANK-TRX-1' });
    expect(paid.body.data.status).toBe('PAID');

    const financeAfter = await request(app).get('/api/v1/provider/finance').set(auth(hotel.accessToken));
    expect(Number(financeAfter.body.data.paidOut)).toBe(1000);
  });

  it('runs the refund approval and processing flow', async () => {
    const requested = await request(app)
      .post('/api/v1/payments/refunds')
      .set(auth(customer.accessToken))
      .send({ bookingReference: booking.reference, amount: '500.00', reason: 'Guide ended the tour two hours early' });
    expect(requested.status).toBe(201);
    expect(requested.body.data.status).toBe('REQUESTED');

    const tooMuch = await request(app)
      .post('/api/v1/payments/refunds')
      .set(auth(customer.accessToken))
      .send({ bookingReference: booking.reference, amount: String(Number(booking.totalAmount)), reason: 'Too much' });
    expect(tooMuch.status).toBe(400);

    const queue = await request(app).get('/api/v1/admin/refunds').set(auth(admin.accessToken));
    expect(queue.body.data.items.length).toBeGreaterThan(0);

    const approved = await request(app)
      .post(`/api/v1/admin/refunds/${requested.body.data.id}/approve`)
      .set(auth(admin.accessToken))
      .send({});
    expect(approved.body.data.status).toBe('APPROVED');

    const processed = await request(app)
      .post(`/api/v1/admin/refunds/${requested.body.data.id}/process`)
      .set(auth(admin.accessToken))
      .send({ providerRefundId: 'BKASH-REF-1', notes: 'Processed in test' });
    expect(processed.body.data.status).toBe('PROCESSED');

    const history = await request(app).get('/api/v1/payments').set(auth(customer.accessToken));
    expect(history.status).toBe(200);
    expect(history.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it('notifies participants and supports scoped messaging', async () => {
    const notifications = await request(app).get('/api/v1/notifications').set(auth(customer.accessToken));
    expect(notifications.status).toBe(200);
    expect(notifications.body.data.items.length).toBeGreaterThan(0);

    const unread = await request(app).get('/api/v1/notifications/unread-count').set(auth(customer.accessToken));
    expect(unread.body.data.unread).toBeGreaterThanOrEqual(1);

    const first = notifications.body.data.items[0];
    const read = await request(app).post(`/api/v1/notifications/${first.id}/read`).set(auth(customer.accessToken));
    expect(read.status).toBe(200);
    expect(read.body.data.readAt).toBeTruthy();

    const ambiguous = await request(app)
      .post('/api/v1/messages')
      .set(auth(customer.accessToken))
      .send({ bookingReference: booking.reference, body: 'Can we get an extra pillow?' });
    expect(ambiguous.status).toBe(400);
    expect(ambiguous.body.code).toBe('RECIPIENT_REQUIRED');

    const hotelProfile = await models.ProviderProfile.findOne({ where: { type: 'HOTEL', status: 'APPROVED' } });
    const message = await request(app)
      .post('/api/v1/messages')
      .set(auth(customer.accessToken))
      .send({ bookingReference: booking.reference, recipientUserId: hotelProfile.user_id, body: 'Can we get an extra pillow?' });
    expect(message.status).toBe(201);

    const thread = await request(app)
      .get('/api/v1/messages')
      .set(auth(hotel.accessToken))
      .query({ bookingReference: booking.reference, withUserId: customer.user.id });
    expect(thread.status).toBe(200);
    expect(Array.isArray(thread.body.data.items)).toBe(true);
  });
});
