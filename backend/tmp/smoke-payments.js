'use strict';

/* Smokes the money paths: payment initiation idempotency, signed gateway
   settlement, commissions, payouts, refunds and messaging. */

const request = require('supertest');
const app = require('../src/app');
const { models, sequelize } = require('../src/models');
const { today, addDays } = require('../src/shared/utils/dates');

let failures = 0;
function check(name, condition, extra) {
  if (condition) console.log(`ok   ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}`);
    if (extra !== undefined) console.log(JSON.stringify(extra, null, 2).slice(0, 1800));
  }
}

async function login(email, password) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) throw new Error(`login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  return response.body.data;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

(async () => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('ADMIN_PASSWORD env var is required for the admin flow');

  const customer = await login('customer@pothik.test', 'PothikDemo123');
  const hotel = await login('hotel.owner@pothik.test', 'PothikDemo123');
  const transport = await login('transport@pothik.test', 'PothikDemo123');
  const guide = await login('guide@pothik.test', 'PothikDemo123');
  const admin = await login('admin@pothik.test', adminPassword);

  const checkIn = addDays(today(), 61);
  const checkout = addDays(today(), 63);

  const hotels = await request(app).get('/api/v1/hotels');
  const hotelSlug = hotels.body.data.items.find((row) => row.slug === 'sea-crown-hotel-resort').slug;
  const hotelDetail = (await request(app).get(`/api/v1/hotels/${hotelSlug}`)).body.data;
  const deluxe = hotelDetail.rooms.find((room) => room.name === 'Deluxe Sea View');
  const vehicles = (await request(app).get('/api/v1/vehicles').query({ search: 'Microbus' })).body.data.items;
  const guidesList = (await request(app).get('/api/v1/guides')).body.data.items;

  const composition = {
    adults: 2,
    children: 0,
    hotel: { hotelId: hotelDetail.id, checkIn, checkOut: checkout, rooms: [{ roomId: deluxe.id, units: 1 }] },
    transport: { vehicleId: vehicles[0].id, startDate: checkIn, endDate: checkout },
    guide: { guideId: guidesList[0].id, startDate: checkIn, endDate: addDays(checkIn, 1) },
  };

  const bookingResponse = await request(app)
    .post('/api/v1/bookings')
    .set(auth(customer.accessToken))
    .send({
      type: 'CUSTOM_TRIP',
      composition,
      contact: { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' },
    });
  check('booking created', bookingResponse.status === 201, bookingResponse.body);
  const booking = bookingResponse.body.data;

  for (const [name, session] of [['hotel', hotel], ['transport', transport], ['guide', guide]]) {
    const accepted = await request(app).post(`/api/v1/provider/bookings/${booking.reference}/accept`).set(auth(session.accessToken));
    check(`${name} accepts`, accepted.status === 200, accepted.body);
  }
  const payable = await request(app).get(`/api/v1/bookings/${booking.reference}`).set(auth(customer.accessToken));
  check('booking payable after all acceptances', payable.body.data.status === 'AWAITING_PAYMENT', payable.body.data.status);
  check('due amount equals total', payable.body.data.dueAmount === booking.totalAmount, payable.body.data);

  // ---- payment initiation -------------------------------------------------
  const half = (Number(booking.totalAmount) / 2).toFixed(2);
  const initiate = await request(app)
    .post('/api/v1/payments')
    .set(auth(customer.accessToken))
    .send({ bookingReference: booking.reference, amount: half, method: 'bkash', idempotencyKey: 'smoke-pay-part-1' });
  check('payment initiated', initiate.status === 201 && initiate.body.data.payment.status === 'PENDING', initiate.body);
  const payment = initiate.body.data.payment;
  check('sandbox redirect issued', String(initiate.body.data.gatewayUrl).includes('/pay/demo/'), initiate.body.data.gatewayUrl);

  const replay = await request(app)
    .post('/api/v1/payments')
    .set(auth(customer.accessToken))
    .send({ bookingReference: booking.reference, amount: half, method: 'bkash', idempotencyKey: 'smoke-pay-part-1' });
  check(
    'idempotent replay returns same payment',
    replay.status === 201 && replay.body.data.payment.id === payment.id && replay.body.data.idempotent === true,
    replay.body
  );

  const conflicting = await request(app)
    .post('/api/v1/payments')
    .set(auth(customer.accessToken))
    .send({ bookingReference: booking.reference, amount: '10.00', method: 'bkash', idempotencyKey: 'smoke-pay-part-1' });
  check('idempotency key cannot be reused with another amount', conflicting.status === 409, conflicting.body);

  const tooMuch = await request(app)
    .post('/api/v1/payments')
    .set(auth(customer.accessToken))
    .send({ bookingReference: booking.reference, amount: String(Number(booking.totalAmount) + 100), method: 'card', idempotencyKey: 'smoke-pay-too-much' });
  check('overpayment rejected before gateway', tooMuch.status === 400 && tooMuch.body.code === 'PAYMENT_EXCEEDS_DUE', tooMuch.body);

  const badSignature = await request(app)
    .post('/api/v1/payments/callback/demo')
    .send({ paymentId: payment.id, amount: half, bookingReference: booking.reference, result: 'SUCCESS', signature: 'deadbeef' });
  check('forged callback rejected', badSignature.status === 400 && badSignature.body.code === 'PAYMENT_VERIFICATION_FAILED', badSignature.body);

  const ownerBlocked = await request(app)
    .post(`/api/v1/payments/${payment.id}/demo-complete`)
    .set(auth(hotel.accessToken));
  check('other users cannot settle someone else’s payment', ownerBlocked.status === 403, ownerBlocked.body);

  const settled = await request(app).post(`/api/v1/payments/${payment.id}/demo-complete`).set(auth(customer.accessToken));
  check('sandbox payment settled', settled.status === 200 && settled.body.data.settled === true, settled.body);
  check('partial payment recorded', settled.body.data.bookingStatus === 'AWAITING_PAYMENT', settled.body.data);

  const settledAgain = await request(app).post(`/api/v1/payments/${payment.id}/demo-complete`).set(auth(customer.accessToken));
  check('duplicate settlement is idempotent', settledAgain.status === 200 && settledAgain.body.data.alreadySettled === true, settledAgain.body);

  const afterPartial = await request(app).get(`/api/v1/bookings/${booking.reference}`).set(auth(customer.accessToken));
  check(
    'due reduced by first payment',
    Number(afterPartial.body.data.paidAmount) === Number(half) && afterPartial.body.data.status === 'AWAITING_PAYMENT',
    afterPartial.body.data
  );

  // ---- remainder and confirmation -----------------------------------------
  const remainder = await request(app)
    .post('/api/v1/payments')
    .set(auth(customer.accessToken))
    .send({ bookingReference: booking.reference, method: 'card', idempotencyKey: 'smoke-pay-part-2' });
  check('balance payment defaults to amount due', Number(remainder.body.data.payment.amount) === Number(afterPartial.body.data.dueAmount), remainder.body);
  const finish = await request(app).post(`/api/v1/payments/${remainder.body.data.payment.id}/demo-complete`).set(auth(customer.accessToken));
  check('full payment confirms booking', finish.status === 200 && finish.body.data.bookingStatus === 'CONFIRMED', finish.body);

  const bookingAfterPay = await request(app).get(`/api/v1/bookings/${booking.reference}`).set(auth(customer.accessToken));
  check('booking fully paid', bookingAfterPay.body.data.dueAmount === '0.00', bookingAfterPay.body.data);

  const commissions = await request(app).get('/api/v1/provider/commissions').set(auth(hotel.accessToken));
  check(
    'provider commissions earned after payment',
    commissions.status === 200 && commissions.body.data.items.some((row) => row.status === 'EARNED'),
    commissions.body
  );

  // ---- trip completion and provider payout --------------------------------
  const started = await request(app).post(`/api/v1/provider/bookings/${booking.reference}/start`).set(auth(hotel.accessToken));
  check('trip started', started.status === 200 && started.body.data.status === 'IN_PROGRESS', started.body.status);
  const completed = await request(app).post(`/api/v1/provider/bookings/${booking.reference}/complete`).set(auth(hotel.accessToken));
  check('trip completed', completed.status === 200 && completed.body.data.status === 'COMPLETED', completed.body.status);

  const finance = await request(app).get('/api/v1/provider/finance').set(auth(hotel.accessToken));
  check('provider finance reports earnings', finance.status === 200 && Number(finance.body.data.earned) > 0, finance.body);

  const payoutRequest = await request(app)
    .post('/api/v1/provider/payouts')
    .set(auth(hotel.accessToken))
    .send({ amount: '1000.00', method: 'bkash', notes: 'Smoke payout' });
  check('payout requested', payoutRequest.status === 201 && payoutRequest.body.data.status === 'REQUESTED', payoutRequest.body);

  const excessivePayout = await request(app)
    .post('/api/v1/provider/payouts')
    .set(auth(hotel.accessToken))
    .send({ amount: '99999999.00', method: 'bkash' });
  check('payout beyond balance rejected', excessivePayout.status === 400 && excessivePayout.body.code === 'PAYOUT_EXCEEDS_BALANCE', excessivePayout.body);

  const adminPayouts = await request(app).get('/api/v1/admin/payouts').set(auth(admin.accessToken));
  check('admin sees payout queue', adminPayouts.status === 200 && adminPayouts.body.data.items.length > 0, adminPayouts.body);
  const payoutId = payoutRequest.body.data.id;
  const approved = await request(app).post(`/api/v1/admin/payouts/${payoutId}/approve`).set(auth(admin.accessToken)).send({});
  check('admin approves payout', approved.status === 200 && approved.body.data.status === 'APPROVED', approved.body);
  const paid = await request(app)
    .post(`/api/v1/admin/payouts/${payoutId}/paid`)
    .set(auth(admin.accessToken))
    .send({ reference: 'BANK-TRX-1' });
  check('admin marks payout paid', paid.status === 200 && paid.body.data.status === 'PAID', paid.body);

  const financeAfter = await request(app).get('/api/v1/provider/finance').set(auth(hotel.accessToken));
  check('payout reduces available balance', Number(financeAfter.body.data.paidOut) === 1000, financeAfter.body);

  // ---- refunds ------------------------------------------------------------
  const refundRequest = await request(app)
    .post('/api/v1/payments/refunds')
    .set(auth(customer.accessToken))
    .send({ bookingReference: booking.reference, amount: '500.00', reason: 'Guide ended the tour two hours early' });
  check('refund requested', refundRequest.status === 201 && refundRequest.body.data.status === 'REQUESTED', refundRequest.body);

  const refundOver = await request(app)
    .post('/api/v1/payments/refunds')
    .set(auth(customer.accessToken))
    .send({ bookingReference: booking.reference, amount: String(Number(booking.totalAmount)), reason: 'Too much' });
  check('refund beyond paid balance rejected', refundOver.status === 400, refundOver.body);

  const adminRefunds = await request(app).get('/api/v1/admin/refunds').set(auth(admin.accessToken));
  check('admin sees refund queue', adminRefunds.status === 200 && adminRefunds.body.data.items.length > 0, adminRefunds.body);

  const refundId = refundRequest.body.data.id;
  const approveRefund = await request(app).post(`/api/v1/admin/refunds/${refundId}/approve`).set(auth(admin.accessToken)).send({});
  check('admin approves refund', approveRefund.status === 200 && approveRefund.body.data.status === 'APPROVED', approveRefund.body);
  const processed = await request(app)
    .post(`/api/v1/admin/refunds/${refundId}/process`)
    .set(auth(admin.accessToken))
    .send({ providerRefundId: 'BKASH-REF-1', notes: 'Processed in smoke test' });
  check('admin processes refund', processed.status === 200 && processed.body.data.status === 'PROCESSED', processed.body);

  const paymentsMine = await request(app).get('/api/v1/payments').set(auth(customer.accessToken));
  check('payment history visible', paymentsMine.status === 200 && paymentsMine.body.data.items.length >= 2, paymentsMine.body);

  // ---- notifications and messages ----------------------------------------
  const notifications = await request(app).get('/api/v1/notifications').set(auth(customer.accessToken));
  check('notifications created for customer', notifications.status === 200 && notifications.body.data.items.length > 0, notifications.body);
  const unread = await request(app).get('/api/v1/notifications/unread-count').set(auth(customer.accessToken));
  check('unread counter works', unread.status === 200 && unread.body.data.unread >= 1, unread.body);
  const firstNotification = notifications.body.data.items[0];
  const markRead = await request(app).post(`/api/v1/notifications/${firstNotification.id}/read`).set(auth(customer.accessToken));
  check('notification marked read', markRead.status === 200 && Boolean(markRead.body.data.readAt), markRead.body);

  const customerMessage = await request(app)
    .post('/api/v1/messages')
    .set(auth(customer.accessToken))
    .send({ bookingReference: booking.reference, body: 'Can we get an extra pillow?' });
  check('multi-provider message needs a recipient', customerMessage.status === 400 && customerMessage.body.code === 'RECIPIENT_REQUIRED', customerMessage.body);

  const hotelProfile = await models.ProviderProfile.findOne({ where: { type: 'HOTEL', status: 'APPROVED' } });
  const hotelMessage = await request(app)
    .post('/api/v1/messages')
    .set(auth(customer.accessToken))
    .send({ bookingReference: booking.reference, recipientUserId: hotelProfile.user_id, body: 'Can we get an extra pillow?' });
  check('scoped message sent to hotel', hotelMessage.status === 201, hotelMessage.body);

  const thread = await request(app)
    .get('/api/v1/messages')
    .set(auth(hotel.accessToken))
    .query({ bookingReference: booking.reference, withUserId: customer.user.id });
  check('provider reads thread', thread.status === 200 && thread.body.data.items.length >= 0, thread.body);

  console.log(failures === 0 ? '\nPAYMENT SMOKE PASSED' : `\nPAYMENT SMOKE FAILURES: ${failures}`);
  await sequelize.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (error) => {
  console.error('PAYMENT SMOKE CRASH', error);
  try {
    await sequelize.close();
  } catch (closeError) {
    /* ignore */
  }
  process.exit(1);
});
