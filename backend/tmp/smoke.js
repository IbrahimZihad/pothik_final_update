'use strict';

/* Local smoke check: exercises public discovery, pricing, booking lifecycle,
   inventory locking, coupon redemption and provider ownership checks. */

const request = require('supertest');
const app = require('../src/app');
const { models, sequelize } = require('../src/models');
const { today, addDays } = require('../src/shared/utils/dates');

let failures = 0;
function check(name, condition, extra) {
  if (condition) {
    console.log(`ok   ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}`);
    if (extra !== undefined) console.log(JSON.stringify(extra, null, 2).slice(0, 1500));
  }
}

async function login(email, password) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) throw new Error(`login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  return response.body.data.accessToken;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

(async () => {
  const checkIn = addDays(today(), 45);
  const checkOut = addDays(today(), 47);

  // ---- public catalogue ---------------------------------------------------
  const hotels = await request(app).get('/api/v1/hotels');
  check('GET /hotels', hotels.status === 200 && hotels.body.data.items.length > 0, hotels.body);
  const hotelSlug = hotels.body.data.items.find((hotel) => hotel.slug === 'sea-crown-hotel-resort')?.slug;
  check('seeded hotel listed', Boolean(hotelSlug));

  const hotel = await request(app).get(`/api/v1/hotels/${hotelSlug}`);
  check('GET /hotels/:slug', hotel.status === 200 && hotel.body.data.rooms.length === 3, hotel.body);
  const hotelId = hotel.body.data.id;
  const deluxe = hotel.body.data.rooms.find((room) => room.name === 'Deluxe Sea View');
  check('hotel rooms priced', Boolean(deluxe) && deluxe.basePrice === 5500);

  const hotelAvailability = await request(app)
    .get(`/api/v1/hotels/${hotelSlug}/availability`)
    .query({ checkIn, checkOut, rooms: 1 });
  check(
    'hotel availability',
    hotelAvailability.status === 200 && hotelAvailability.body.data.rooms.some((room) => room.available),
    hotelAvailability.body
  );

  const vehicles = await request(app).get('/api/v1/vehicles').query({ search: 'Microbus' });
  check('GET /vehicles', vehicles.status === 200 && vehicles.body.data.items.length > 0, vehicles.body);
  const microbus = vehicles.body.data.items[0];

  const guides = await request(app).get('/api/v1/guides').query({ language: 'Bangla' });
  check('GET /guides', guides.status === 200 && guides.body.data.items.length > 0, guides.body);
  const guide = guides.body.data.items[0];

  const addons = await request(app).get('/api/v1/trips/addons');
  check('GET /trips/addons', addons.status === 200 && addons.body.data.length >= 5, addons.body);

  // ---- auth ---------------------------------------------------------------
  const customerToken = await login('customer@pothik.test', 'PothikDemo123');
  const hotelToken = await login('hotel.owner@pothik.test', 'PothikDemo123');
  const transportToken = await login('transport@pothik.test', 'PothikDemo123');
  const guideToken = await login('guide@pothik.test', 'PothikDemo123');

  const unauth = await request(app).post('/api/v1/bookings').send({});
  check('booking requires auth', unauth.status === 401, unauth.body);

  const customerAsProvider = await request(app).get('/api/v1/provider/hotels').set(auth(customerToken));
  check('customer blocked from provider API', customerAsProvider.status === 403, customerAsProvider.body);

  // ---- custom trip quote ---------------------------------------------------
  const composition = {
    adults: 2,
    children: 1,
    hotel: { hotelId, checkIn, checkOut, rooms: [{ roomId: deluxe.id, units: 1 }] },
    transport: { vehicleId: microbus.id, startDate: checkIn, endDate: checkOut },
    guide: { guideId: guide.id, startDate: checkIn, endDate: addDays(checkIn, 1) },
    addons: [{ code: 'AIRPORT_TRANSFER', quantity: 1 }],
  };

  const quote = await request(app).post('/api/v1/trips/quote').set(auth(customerToken)).send({ composition });
  check('quote succeeds', quote.status === 200, quote.body);
  check(
    'quote total is server computed',
    quote.body.data?.subtotal === '35500.00' && quote.body.data?.totalAmount === '35500.00',
    quote.body.data
  );

  const couponQuote = await request(app)
    .post('/api/v1/trips/quote')
    .set(auth(customerToken))
    .send({ composition, couponCode: 'POTHIK10' });
  check(
    'coupon quote applies 10% capped at 2000',
    couponQuote.status === 200 && couponQuote.body.data.discountTotal === '2000.00' && couponQuote.body.data.totalAmount === '33500.00',
    couponQuote.body
  );

  // saving a trip stores a server quotation
  const savedTrip = await request(app).post('/api/v1/trips').set(auth(customerToken)).send({ title: 'Cox trip', composition });
  check('trip saved', savedTrip.status === 201 && savedTrip.body.data.status === 'QUOTED', savedTrip.body);

  // ---- booking create ------------------------------------------------------
  const created = await request(app)
    .post('/api/v1/bookings')
    .set(auth(customerToken))
    .send({
      type: 'CUSTOM_TRIP',
      composition,
      couponCode: 'POTHIK10',
      contact: { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' },
      passengers: [{ fullName: 'Ayesha Rahman', age: 32, gender: 'FEMALE' }],
    });
  check('booking created', created.status === 201, created.body);
  const booking = created.body.data;
  check('booking awaiting confirmation', booking?.status === 'AWAITING_CONFIRMATION', booking);
  check('booking totals persisted', booking?.totalAmount === '33500.00' && booking?.dueAmount === '33500.00', booking);
  check(
    'commission snapshots stored',
    booking?.items?.filter((item) => item.providerProfileId).every((item) => item.commissionRate > 0),
    booking?.items
  );

  const availabilityAfterBooking = await request(app)
    .get(`/api/v1/hotels/${hotelSlug}/availability`)
    .query({ checkIn, checkOut, rooms: 1 });
  const deluxeAvailability = availabilityAfterBooking.body.data.rooms.find((room) => room.roomId === deluxe.id);
  check('inventory reserved on booking', deluxeAvailability.remainingUnits === 7, deluxeAvailability);

  const overbook = await request(app)
    .post('/api/v1/trips/quote')
    .set(auth(customerToken))
    .send({
      composition: {
        adults: 16,
        children: 0,
        hotel: { hotelId, checkIn, checkOut, rooms: [{ roomId: deluxe.id, units: 8 }] },
      },
    });
  check('overbooking rejected at quote', overbook.status === 400 && overbook.body.code === 'ROOM_UNAVAILABLE', overbook.body);

  // provider cannot touch another module's inventory
  const vehicleAsHotel = await request(app).patch('/api/v1/provider/vehicles/1').set(auth(hotelToken)).send({ capacity: 5 });
  check('hotel owner blocked from vehicle API', vehicleAsHotel.status === 403, vehicleAsHotel.body);

  // ---- provider confirmations ---------------------------------------------
  const providerList = await request(app).get('/api/v1/provider/bookings').set(auth(hotelToken));
  check('hotel provider sees own bookings', providerList.status === 200 && providerList.body.data.items.some((b) => b.reference === booking.reference), providerList.body);

  const acceptHotel = await request(app).post(`/api/v1/provider/bookings/${booking.reference}/accept`).set(auth(hotelToken));
  check('hotel accepts', acceptHotel.status === 200 && acceptHotel.body.data.status === 'AWAITING_CONFIRMATION', acceptHotel.body);

  const acceptTransport = await request(app).post(`/api/v1/provider/bookings/${booking.reference}/accept`).set(auth(transportToken));
  check('transport accepts', acceptTransport.status === 200 && acceptTransport.body.data.status === 'AWAITING_CONFIRMATION', acceptTransport.body);

  const acceptGuide = await request(app).post(`/api/v1/provider/bookings/${booking.reference}/accept`).set(auth(guideToken));
  check('guide accepts last -> awaiting payment', acceptGuide.status === 200 && acceptGuide.body.data.status === 'AWAITING_PAYMENT', acceptGuide.body);

  // ---- cancellation releases inventory ------------------------------------
  const cancel = await request(app)
    .post(`/api/v1/bookings/${booking.reference}/cancel`)
    .set(auth(customerToken))
    .send({ reason: 'Plans changed' });
  check('customer cancels', cancel.status === 200 && cancel.body.data.status === 'CANCELLED', cancel.body);

  const availabilityAfterCancel = await request(app)
    .get(`/api/v1/hotels/${hotelSlug}/availability`)
    .query({ checkIn, checkOut, rooms: 1 });
  const deluxeAfterCancel = availabilityAfterCancel.body.data.rooms.find((room) => room.roomId === deluxe.id);
  check('inventory released on cancel', deluxeAfterCancel.remainingUnits === 8, deluxeAfterCancel);

  const vehicleRows = await models.VehicleAvailability.findAll({ where: { vehicle_id: microbus.id, date: checkIn } });
  check('vehicle availability released', vehicleRows.every((row) => row.status === 'AVAILABLE'), vehicleRows.map((r) => r.status));

  const couponAfter = await models.Coupon.findOne({ where: { code: 'POTHIK10' } });
  check('coupon usage counted', Number(couponAfter.used_count) === 1, { used: couponAfter.used_count });

  // ---- provider availability management ----------------------------------
  const providerHotels = await request(app).get('/api/v1/provider/hotels').set(auth(hotelToken));
  const ownHotel = providerHotels.body.data?.find((row) => row.id === hotelId);
  check('provider hotel list', Boolean(ownHotel) && ownHotel.rooms.length === 3, providerHotels.body);
  const ownRoom = ownHotel.rooms.find((room) => room.id === deluxe.id);
  const blockDate = addDays(today(), 50);
  const blocked = await request(app)
    .put(`/api/v1/provider/rooms/${ownRoom.id}/availability`)
    .set(auth(hotelToken))
    .send({ dates: [{ date: blockDate, isBlocked: true }] });
  check('provider blocks a date', blocked.status === 200 && blocked.body.data[0].isBlocked === true, blocked.body);

  const blockedQuote = await request(app)
    .post('/api/v1/trips/quote')
    .set(auth(customerToken))
    .send({
      composition: {
        adults: 2,
        hotel: { hotelId, checkIn: blockDate, checkOut: addDays(blockDate, 1), rooms: [{ roomId: deluxe.id, units: 1 }] },
      },
    });
  check('blocked date rejects quote', blockedQuote.status === 400 && blockedQuote.body.code === 'ROOM_UNAVAILABLE', blockedQuote.body);

  // ---- package booking ----------------------------------------------------
  const packageList = await request(app).get('/api/v1/packages');
  const packageSlug = packageList.body.data.items[0].slug;
  const packageDetail = await request(app).get(`/api/v1/packages/${packageSlug}`);
  const departure = packageDetail.body.data.departures[0];
  const packageQuote = await request(app)
    .post('/api/v1/trips/quote')
    .set(auth(customerToken))
    .send({
      composition: { adults: 2, children: 0, package: { packageId: packageDetail.body.data.id, departureId: departure.id } },
    });
  check('package quote', packageQuote.status === 200 && packageQuote.body.data.items.length === 1, packageQuote.body);
  check('package quote uses departure dates', packageQuote.body.data.startDate === departure.startDate, packageQuote.body.data);

  const packageBooking = await request(app)
    .post('/api/v1/bookings')
    .set(auth(customerToken))
    .send({
      type: 'PACKAGE',
      composition: { adults: 2, package: { packageId: packageDetail.body.data.id, departureId: departure.id } },
      contact: { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' },
    });
  check('package booking created', packageBooking.status === 201 && packageBooking.body.data.type === 'PACKAGE', packageBooking.body);

  const departureRow = await models.PackageDeparture.findByPk(departure.id);
  check('package seats held', Number(departureRow.booked_count) >= 2, { booked: departureRow.booked_count });

  // ---- guide profile update ----------------------------------------------
  const guideProfile = await request(app)
    .put('/api/v1/provider/guide')
    .set(auth(guideToken))
    .send({ dailyRate: 3800, languages: ['Bangla', 'English'], bio: 'Updated bio for smoke test.' });
  check('guide profile upsert', guideProfile.status === 200 && guideProfile.body.data.dailyRate === 3800, guideProfile.body);

  // ---- trip listing -------------------------------------------------------
  const trips = await request(app).get('/api/v1/trips').set(auth(customerToken));
  check('trip list', trips.status === 200 && trips.body.data.items.some((trip) => trip.id === savedTrip.body.data.id), trips.body);

  console.log(failures === 0 ? '\nSMOKE PASSED' : `\nSMOKE FAILURES: ${failures}`);
  await sequelize.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (error) => {
  console.error('SMOKE CRASH', error);
  try {
    await sequelize.close();
  } catch (closeError) {
    /* ignore */
  }
  process.exit(1);
});
