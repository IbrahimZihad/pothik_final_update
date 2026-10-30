'use strict';

const { setupDatabase, closeDatabase } = require('./helpers/db');
const { request, app, login, auth } = require('./helpers/session');
const { models } = require('../src/models');
const { today, addDays } = require('../src/shared/utils/dates');

jest.setTimeout(60000);

describe('reviews and verified bookings', () => {
  let customer;
  let hotel;
  let transport;
  let admin;
  let hotelId;
  let completedBookingId;
  let reviewId;
  let reviewBooking;

  beforeAll(async () => {
    await setupDatabase();
    customer = await login('customer@pothik.test', 'PothikDemo123');
    hotel = await login('hotel.owner@pothik.test', 'PothikDemo123');
    transport = await login('transport@pothik.test', 'PothikDemo123');
    admin = await login('admin@pothik.test', process.env.ADMIN_PASSWORD);

    // PTK-SEED-1001 is the seeded completed package trip that carries reviews.
    const seededCompleted = await models.Booking.findOne({ where: { reference: 'PTK-SEED-1001' } });
    completedBookingId = seededCompleted.id;

    const checkIn = addDays(today(), 50);
    const checkOut = addDays(today(), 52);
    const hotels = await request(app).get('/api/v1/hotels');
    const slug = hotels.body.data.items.find((row) => row.slug === 'sea-crown-hotel-resort').slug;
    const detail = (await request(app).get(`/api/v1/hotels/${slug}`)).body.data;
    hotelId = detail.id;
    const deluxe = detail.rooms.find((room) => room.name === 'Deluxe Sea View');

    const booking = await request(app)
      .post('/api/v1/bookings')
      .set(auth(customer.accessToken))
      .send({
        type: 'HOTEL',
        composition: { adults: 2, hotel: { hotelId, checkIn, checkOut, rooms: [{ roomId: deluxe.id, units: 1 }] } },
        contact: { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' },
      });
    expect(booking.status).toBe(201);

    const accepted = await request(app)
      .post(`/api/v1/provider/bookings/${booking.body.data.reference}/accept`)
      .set(auth(hotel.accessToken));
    expect(accepted.status).toBe(200);

    const payment = await request(app)
      .post('/api/v1/payments')
      .set(auth(customer.accessToken))
      .send({ bookingReference: booking.body.data.reference, method: 'bkash', idempotencyKey: 'jest-review-pay' });
    expect(payment.status).toBe(201);
    const settled = await request(app)
      .post(`/api/v1/payments/${payment.body.data.payment.id}/demo-complete`)
      .set(auth(customer.accessToken));
    expect(settled.body.data.bookingStatus).toBe('CONFIRMED');

    await request(app).post(`/api/v1/provider/bookings/${booking.body.data.reference}/start`).set(auth(hotel.accessToken));
    const completed = await request(app)
      .post(`/api/v1/provider/bookings/${booking.body.data.reference}/complete`)
      .set(auth(hotel.accessToken));
    expect(completed.body.data.status).toBe('COMPLETED');

    reviewBooking = await models.Booking.findOne({ where: { reference: booking.body.data.reference } });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('lists only approved reviews with filters', async () => {
    const list = await request(app).get('/api/v1/reviews').query({ limit: 20 });
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBeGreaterThan(0);
    expect(list.body.data.items.every((row) => row.status === 'APPROVED')).toBe(true);

    const filtered = await request(app).get('/api/v1/reviews').query({ targetType: 'DESTINATION', rating: 5 });
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.items.every((row) => row.target_type === 'DESTINATION')).toBe(true);
  });

  it('rejects reviews on bookings that are not completed', async () => {
    const pending = await models.Booking.findOne({ where: { customer_user_id: customer.user.id, status: 'AWAITING_PAYMENT' } });
    const response = await request(app)
      .post('/api/v1/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: pending.id, targetType: 'PACKAGE', targetId: pending.id, rating: 5 });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('BOOKING_NOT_COMPLETED');
  });

  it('rejects duplicate and out-of-scope reviews', async () => {
    const seededPackageReview = await models.Review.findOne({ where: { booking_id: completedBookingId, target_type: 'PACKAGE' } });
    const duplicate = await request(app)
      .post('/api/v1/reviews')
      .set(auth(customer.accessToken))
      .send({
        bookingId: completedBookingId,
        targetType: 'PACKAGE',
        targetId: seededPackageReview.target_id,
        rating: 4,
      });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.code).toBe('REVIEW_EXISTS');

    const destinations = await request(app).get('/api/v1/destinations');
    const destinationIds = destinations.body.data.items.map((row) => row.id);
    const linked = await models.Review.findOne({ where: { booking_id: completedBookingId, target_type: 'DESTINATION' } });
    const unlinkedId = destinationIds.find((id) => id !== Number(linked.target_id));

    const outOfScope = await request(app)
      .post('/api/v1/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: completedBookingId, targetType: 'DESTINATION', targetId: unlinkedId, rating: 4 });
    expect(outOfScope.status).toBe(403);

    const invalidRating = await request(app)
      .post('/api/v1/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: completedBookingId, targetType: 'PACKAGE', targetId: seededPackageReview.target_id, rating: 9 });
    expect(invalidRating.status).toBe(422);
  });

  it('creates a pending review for a completed hotel booking', async () => {
    const created = await request(app)
      .post('/api/v1/reviews')
      .set(auth(customer.accessToken))
      .send({ bookingId: reviewBooking.id, targetType: 'HOTEL', targetId: hotelId, rating: 5, title: 'Great stay', comment: 'Spotless room and friendly staff.' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('PENDING');
    expect(created.body.data.is_verified).toBe(true);
    reviewId = created.body.data.id;

    const beforeApproval = await request(app).get('/api/v1/reviews').query({ targetType: 'HOTEL', targetId: hotelId });
    expect(beforeApproval.body.data.items.some((row) => row.id === reviewId)).toBe(false);
  });

  it('lets only the owning provider reply', async () => {
    const ownReply = await request(app)
      .patch(`/api/v1/reviews/${reviewId}/reply`)
      .set(auth(hotel.accessToken))
      .send({ reply: 'Thank you for staying with us!' });
    expect(ownReply.status).toBe(200);
    expect(ownReply.body.data.provider_reply).toMatch(/thank you/i);

    const wrongProvider = await request(app)
      .patch(`/api/v1/reviews/${reviewId}/reply`)
      .set(auth(transport.accessToken))
      .send({ reply: 'This is not our hotel' });
    expect(wrongProvider.status).toBe(403);
  });

  it('publishes the review after moderation and refreshes the rating', async () => {
    const approved = await request(app)
      .post(`/api/v1/admin/reviews/${reviewId}/moderate`)
      .set(auth(admin.accessToken))
      .send({ status: 'APPROVED' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');

    const list = await request(app).get('/api/v1/reviews').query({ targetType: 'HOTEL', targetId: hotelId });
    expect(list.body.data.items.some((row) => row.id === reviewId)).toBe(true);

    const hotelRow = await models.Hotel.findByPk(hotelId);
    expect(Number(hotelRow.rating_count)).toBeGreaterThanOrEqual(1);
    expect(Number(hotelRow.rating_avg)).toBeGreaterThan(0);
  });
});
