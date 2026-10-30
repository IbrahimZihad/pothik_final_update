'use strict';

const { setupDatabase, closeDatabase } = require('./helpers/db');
const { request, app, login, auth } = require('./helpers/session');
const { models } = require('../../src/models');
const { today, addDays } = require('../../src/shared/utils/dates');

jest.setTimeout(40000);

describe('booking engine', () => {
  const checkIn = addDays(today(), 45);
  const checkOut = addDays(today(), 47);
  let customer;
  let hotel;
  let transport;
  let guide;
  let hotelSlug;
  let hotelId;
  let deluxe;
  let composition;
  let bookingReference;

  beforeAll(async () => {
    await setupDatabase();
    customer = await login('customer@pothik.test', 'PothikDemo123');
    hotel = await login('hotel.owner@pothik.test', 'PothikDemo123');
    transport = await login('transport@pothik.test', 'PothikDemo123');
    guide = await login('guide@pothik.test', 'PothikDemo123');

    const hotels = await request(app).get('/api/v1/hotels');
    hotelSlug = hotels.body.data.items.find((row) => row.slug === 'sea-crown-hotel-resort').slug;
    const detail = (await request(app).get(`/api/v1/hotels/${hotelSlug}`)).body.data;
    hotelId = detail.id;
    deluxe = detail.rooms.find((room) => room.name === 'Deluxe Sea View');

    const microbus = (await request(app).get('/api/v1/vehicles').query({ search: 'Microbus' })).body.data.items[0];
    const guideRow = (await request(app).get('/api/v1/guides').query({ language: 'Bangla' })).body.data.items[0];

    composition = {
      adults: 2,
      children: 1,
      hotel: { hotelId, checkIn, checkOut, rooms: [{ roomId: deluxe.id, units: 1 }] },
      transport: { vehicleId: microbus.id, startDate: checkIn, endDate: checkOut },
      guide: { guideId: guideRow.id, startDate: checkIn, endDate: addDays(checkIn, 1) },
      addons: [{ code: 'AIRPORT_TRANSFER', quantity: 1 }],
    };
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('serves the seeded catalogue', async () => {
    const hotels = await request(app).get('/api/v1/hotels');
    expect(hotels.status).toBe(200);
    expect(hotels.body.data.items.length).toBeGreaterThan(0);

    const hotelDetail = await request(app).get(`/api/v1/hotels/${hotelSlug}`);
    expect(hotelDetail.status).toBe(200);
    expect(hotelDetail.body.data.rooms).toHaveLength(3);
    expect(deluxe.basePrice).toBe(5500);

    const availability = await request(app)
      .get(`/api/v1/hotels/${hotelSlug}/availability`)
      .query({ checkIn, checkOut, rooms: 1 });
    expect(availability.status).toBe(200);
    expect(availability.body.data.rooms.some((room) => room.available)).toBe(true);

    const addons = await request(app).get('/api/v1/trips/addons');
    expect(addons.status).toBe(200);
    expect(addons.body.data.length).toBeGreaterThanOrEqual(5);
  });

  it('computes quotes server-side and ignores client totals', async () => {
    const quote = await request(app)
      .post('/api/v1/trips/quote')
      .set(auth(customer.accessToken))
      .send({ composition, subtotal: '1.00', totalAmount: '1.00' });

    expect(quote.status).toBe(200);
    expect(quote.body.data.subtotal).toBe('35500.00');
    expect(quote.body.data.totalAmount).toBe('35500.00');
  });

  it('applies coupon rules on the server', async () => {
    const quote = await request(app)
      .post('/api/v1/trips/quote')
      .set(auth(customer.accessToken))
      .send({ composition, couponCode: 'POTHIK10' });

    expect(quote.status).toBe(200);
    expect(quote.body.data.discountTotal).toBe('2000.00');
    expect(quote.body.data.totalAmount).toBe('33500.00');
  });

  it('stores saved trips with a server quotation', async () => {
    const saved = await request(app).post('/api/v1/trips').set(auth(customer.accessToken)).send({ title: 'Cox trip', composition });
    expect(saved.status).toBe(201);
    expect(saved.body.data.status).toBe('QUOTED');

    const list = await request(app).get('/api/v1/trips').set(auth(customer.accessToken));
    expect(list.body.data.items.some((trip) => trip.id === saved.body.data.id)).toBe(true);
  });

  it('creates a booking, reserves inventory and snapshots commissions', async () => {
    const created = await request(app)
      .post('/api/v1/bookings')
      .set(auth(customer.accessToken))
      .send({
        type: 'CUSTOM_TRIP',
        composition,
        couponCode: 'POTHIK10',
        contact: { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' },
        passengers: [{ fullName: 'Ayesha Rahman', age: 32, gender: 'FEMALE' }],
      });

    expect(created.status).toBe(201);
    const booking = created.body.data;
    expect(booking.status).toBe('AWAITING_CONFIRMATION');
    expect(booking.totalAmount).toBe('33500.00');
    expect(booking.dueAmount).toBe('33500.00');
    expect(booking.items.filter((item) => item.providerProfileId).every((item) => item.commissionRate > 0)).toBe(true);
    expect(JSON.stringify(booking)).not.toMatch(/password_hash/i);

    const availability = await request(app)
      .get(`/api/v1/hotels/${hotelSlug}/availability`)
      .query({ checkIn, checkOut, rooms: 1 });
    const room = availability.body.data.rooms.find((row) => row.roomId === deluxe.id);
    expect(room.remainingUnits).toBe(7);

    bookingReference = booking.reference;
  });

  it('rejects overbooking before inventory is touched', async () => {
    const overbook = await request(app)
      .post('/api/v1/trips/quote')
      .set(auth(customer.accessToken))
      .send({
        composition: {
          adults: 16,
          hotel: { hotelId, checkIn, checkOut, rooms: [{ roomId: deluxe.id, units: 8 }] },
        },
      });
    expect(overbook.status).toBe(400);
    expect(overbook.body.code).toBe('ROOM_UNAVAILABLE');

    const twice = await request(app)
      .post('/api/v1/trips/quote')
      .set(auth(customer.accessToken))
      .send({
        composition: {
          adults: 16,
          hotel: { hotelId, checkIn, checkOut, rooms: [{ roomId: deluxe.id, units: 7 }] },
        },
      });
    expect(twice.status).toBe(200);
  });

  it('refuses a second booking for inventory that is already held', async () => {
    const blockedDates = { start: addDays(today(), 71), end: addDays(today(), 73) };
    const compositionFor = (startDate, endDate) => ({
      adults: 16,
      hotel: { hotelId, checkIn: startDate, checkOut: endDate, rooms: [{ roomId: deluxe.id, units: 8 }] },
    });

    const first = await request(app)
      .post('/api/v1/bookings')
      .set(auth(customer.accessToken))
      .send({
        type: 'HOTEL',
        composition: compositionFor(blockedDates.start, blockedDates.end),
        contact: { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' },
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/bookings')
      .set(auth(customer.accessToken))
      .send({
        type: 'HOTEL',
        composition: compositionFor(blockedDates.start, blockedDates.end),
        contact: { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' },
      });
    expect(second.status).toBe(400);
    expect(second.body.code).toBe('ROOM_UNAVAILABLE');
  });

  it('moves through provider acceptance and releases everything on cancel', async () => {
    const reference = bookingReference;

    const hotelAccept = await request(app).post(`/api/v1/provider/bookings/${reference}/accept`).set(auth(hotel.accessToken));
    expect(hotelAccept.status).toBe(200);
    expect(hotelAccept.body.data.status).toBe('AWAITING_CONFIRMATION');

    const transportAccept = await request(app).post(`/api/v1/provider/bookings/${reference}/accept`).set(auth(transport.accessToken));
    expect(transportAccept.status).toBe(200);

    const guideAccept = await request(app).post(`/api/v1/provider/bookings/${reference}/accept`).set(auth(guide.accessToken));
    expect(guideAccept.status).toBe(200);
    expect(guideAccept.body.data.status).toBe('AWAITING_PAYMENT');

    const cancel = await request(app)
      .post(`/api/v1/bookings/${reference}/cancel`)
      .set(auth(customer.accessToken))
      .send({ reason: 'Plans changed' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('CANCELLED');

    const availability = await request(app)
      .get(`/api/v1/hotels/${hotelSlug}/availability`)
      .query({ checkIn, checkOut, rooms: 1 });
    const room = availability.body.data.rooms.find((row) => row.roomId === deluxe.id);
    expect(room.remainingUnits).toBe(8);

    const vehicleRows = await models.VehicleAvailability.findAll({ where: { date: checkIn } });
    expect(vehicleRows.every((row) => row.status === 'AVAILABLE')).toBe(true);

    const coupon = await models.Coupon.findOne({ where: { code: 'POTHIK10' } });
    expect(Number(coupon.used_count)).toBe(1);
  });

  it('books packages against departure seats', async () => {
    const packages = await request(app).get('/api/v1/packages');
    const detail = (await request(app).get(`/api/v1/packages/${packages.body.data.items[0].slug}`)).body.data;
    const departure = detail.departures[0];

    const quote = await request(app)
      .post('/api/v1/trips/quote')
      .set(auth(customer.accessToken))
      .send({ composition: { adults: 2, package: { packageId: detail.id, departureId: departure.id } } });
    expect(quote.status).toBe(200);
    expect(quote.body.data.items).toHaveLength(1);
    expect(quote.body.data.startDate).toBe(departure.startDate);

    const created = await request(app)
      .post('/api/v1/bookings')
      .set(auth(customer.accessToken))
      .send({
        type: 'PACKAGE',
        composition: { adults: 2, package: { packageId: detail.id, departureId: departure.id } },
        contact: { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' },
      });
    expect(created.status).toBe(201);
    expect(created.body.data.type).toBe('PACKAGE');

    const departureRow = await models.PackageDeparture.findByPk(departure.id);
    expect(Number(departureRow.booked_count)).toBeGreaterThanOrEqual(2);
  });
});
