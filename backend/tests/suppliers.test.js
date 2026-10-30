'use strict';

const { setupDatabase, closeDatabase } = require('./helpers/db');
const { request, app, login, auth } = require('./helpers/session');
const { models } = require('../src/models');
const { today, addDays } = require('../src/shared/utils/dates');

jest.setTimeout(40000);

describe('provider supplier management', () => {
  let hotel;
  let transport;
  let guide;
  let destinationId;
  let createdHotel;
  let createdRoom;
  let createdVehicle;
  let categoryId;

  beforeAll(async () => {
    await setupDatabase();
    hotel = await login('hotel.owner@pothik.test', 'PothikDemo123');
    transport = await login('transport@pothik.test', 'PothikDemo123');
    guide = await login('guide@pothik.test', 'PothikDemo123');
    const destinations = await request(app).get('/api/v1/destinations');
    destinationId = destinations.body.data.items[0].id;
    const categories = await request(app).get('/api/v1/vehicle-categories');
    categoryId = categories.body.data[0].id;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('reads and updates the provider profile and lists documents', async () => {
    const profile = await request(app).get('/api/v1/provider/profile').set(auth(hotel.accessToken));
    expect(profile.status).toBe(200);
    expect(profile.body.data.type).toBe('HOTEL');

    const updated = await request(app)
      .patch('/api/v1/provider/profile')
      .set(auth(hotel.accessToken))
      .send({ description: 'Family-run beachfront hotel.', address: 'Kolatoli, Cox’s Bazar' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.description).toBe('Family-run beachfront hotel.');

    const documents = await request(app).get('/api/v1/provider/documents').set(auth(hotel.accessToken));
    expect(documents.status).toBe(200);
    expect(Array.isArray(documents.body.data)).toBe(true);
  });

  it('stores verification documents privately and serves them only to their owner', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
    const uploaded = await request(app)
      .post('/api/v1/provider/documents')
      .set(auth(hotel.accessToken))
      .field('type', 'TRADE_LICENSE')
      .attach('file', png, { filename: 'license.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data.fileUrl).toMatch(/^\/api\/v1\/provider\/documents\/\d+\/file$/);

    const owner = await request(app).get(uploaded.body.data.fileUrl).set(auth(hotel.accessToken));
    expect(owner.status).toBe(200);
    expect(owner.headers['content-type']).toMatch(/image\/png/);

    const otherProvider = await request(app).get(uploaded.body.data.fileUrl).set(auth(transport.accessToken));
    expect([403, 404]).toContain(otherProvider.status);

    const anonymous = await request(app).get(uploaded.body.data.fileUrl);
    expect(anonymous.status).toBe(401);

    const stored = await models.ProviderDocument.findByPk(uploaded.body.data.id);
    expect(stored.file_url).toMatch(/^\/uploads\/private\//);
    const direct = await request(app).get(stored.file_url);
    expect(direct.status).toBe(404);
  });

  it('creates and updates a hotel and its rooms', async () => {
    const created = await request(app)
      .post('/api/v1/provider/hotels')
      .set(auth(hotel.accessToken))
      .send({ name: 'Jest Bay Resort', destinationId, starRating: 3, description: 'Test property', status: 'DRAFT' });
    expect(created.status).toBe(201);
    createdHotel = created.body.data;

    const updated = await request(app)
      .patch(`/api/v1/provider/hotels/${createdHotel.id}`)
      .set(auth(hotel.accessToken))
      .send({ description: 'Updated description', facilities: ['Wi-Fi', 'Parking'] });
    expect(updated.status).toBe(200);
    expect(updated.body.data.description).toBe('Updated description');

    const room = await request(app)
      .post(`/api/v1/provider/hotels/${createdHotel.id}/rooms`)
      .set(auth(hotel.accessToken))
      .send({ name: 'Jest Garden Room', roomType: 'DOUBLE', capacityAdults: 2, basePrice: 3500, totalUnits: 4 });
    expect(room.status).toBe(201);
    createdRoom = room.body.data;

    const roomUpdate = await request(app)
      .patch(`/api/v1/provider/rooms/${createdRoom.id}`)
      .set(auth(hotel.accessToken))
      .send({ basePrice: 3800, totalUnits: 5 });
    expect(roomUpdate.status).toBe(200);
    expect(Number(roomUpdate.body.data.basePrice)).toBe(3800);

    const availability = await request(app)
      .get(`/api/v1/provider/rooms/${createdRoom.id}/availability`)
      .set(auth(hotel.accessToken))
      .query({ from: addDays(today(), 80), to: addDays(today(), 82) });
    expect(availability.status).toBe(200);

    const blocked = await request(app)
      .put(`/api/v1/provider/rooms/${createdRoom.id}/availability`)
      .set(auth(hotel.accessToken))
      .send({ dates: [{ date: addDays(today(), 81), isBlocked: true }] });
    expect(blocked.status).toBe(200);
    expect(blocked.body.data[0].isBlocked).toBe(true);

    const archived = await request(app)
      .delete(`/api/v1/provider/rooms/${createdRoom.id}`)
      .set(auth(hotel.accessToken));
    expect(archived.status).toBe(200);

    const hotels = await request(app).get('/api/v1/provider/hotels').set(auth(hotel.accessToken));
    expect(hotels.body.data.some((row) => row.id === createdHotel.id)).toBe(true);
    const archivedRoom = hotels.body.data.find((row) => row.id === createdHotel.id).rooms.find((row) => row.id === createdRoom.id);
    expect(archivedRoom.status).not.toBe('ACTIVE');
  });

  it('manages vehicles, drivers and transport availability', async () => {
    const created = await request(app)
      .post('/api/v1/provider/vehicles')
      .set(auth(transport.accessToken))
      .send({
        name: 'Jest Hiace',
        categoryId: categoryId,
        registrationNo: 'DHAKA-HA-11-9999',
        capacity: 10,
        pricePerDay: 5000,
        features: ['AC', 'Music system'],
      });
    expect(created.status).toBe(201);
    createdVehicle = created.body.data;

    const updated = await request(app)
      .patch(`/api/v1/provider/vehicles/${createdVehicle.id}`)
      .set(auth(transport.accessToken))
      .send({ pricePerDay: 5500, status: 'MAINTENANCE' });
    expect(updated.status).toBe(200);
    expect(Number(updated.body.data.pricePerDay)).toBe(5500);

    const availability = await request(app)
      .get(`/api/v1/provider/vehicles/${createdVehicle.id}/availability`)
      .set(auth(transport.accessToken))
      .query({ from: addDays(today(), 85), to: addDays(today(), 86) });
    expect(availability.status).toBe(200);

    const blocked = await request(app)
      .put(`/api/v1/provider/vehicles/${createdVehicle.id}/availability`)
      .set(auth(transport.accessToken))
      .send({ dates: [{ date: addDays(today(), 85), status: 'BLOCKED' }] });
    expect(blocked.status).toBe(200);

    const driver = await request(app)
      .post('/api/v1/provider/drivers')
      .set(auth(transport.accessToken))
      .send({ name: 'Jest Driver', phone: '01711112222', licenseNo: 'DL-JEST-1', vehicleId: createdVehicle.id });
    expect(driver.status).toBe(201);

    const drivers = await request(app).get('/api/v1/provider/drivers').set(auth(transport.accessToken));
    expect(drivers.body.data.some((row) => row.id === driver.body.data.id)).toBe(true);

    const updatedDriver = await request(app)
      .patch(`/api/v1/provider/drivers/${driver.body.data.id}`)
      .set(auth(transport.accessToken))
      .send({ status: 'ON_LEAVE' });
    expect(updatedDriver.body.data.status).toBe('ON_LEAVE');

    const archivedDriver = await request(app)
      .delete(`/api/v1/provider/drivers/${driver.body.data.id}`)
      .set(auth(transport.accessToken));
    expect(archivedDriver.status).toBe(200);
    expect(archivedDriver.body.data.archived).toBe(true);

    const driversAfter = await request(app).get('/api/v1/provider/drivers').set(auth(transport.accessToken));
    expect(driversAfter.body.data.find((row) => row.id === driver.body.data.id).status).toBe('INACTIVE');
  });

  it('manages the guide profile and availability', async () => {
    const profile = await request(app).get('/api/v1/provider/guide').set(auth(guide.accessToken));
    expect(profile.status).toBe(200);

    const saved = await request(app)
      .put('/api/v1/provider/guide')
      .set(auth(guide.accessToken))
      .send({ dailyRate: 3900, languages: ['Bangla', 'English'], yearsExperience: 6, expertise: ['Heritage', 'Nature'] });
    expect(saved.status).toBe(200);
    expect(saved.body.data.dailyRate).toBe(3900);

    const availability = await request(app)
      .get('/api/v1/provider/guide/availability')
      .set(auth(guide.accessToken))
      .query({ from: addDays(today(), 88), to: addDays(today(), 89) });
    expect(availability.status).toBe(200);

    const blocked = await request(app)
      .put('/api/v1/provider/guide/availability')
      .set(auth(guide.accessToken))
      .send({ dates: [{ date: addDays(today(), 88), status: 'BLOCKED' }] });
    expect(blocked.status).toBe(200);
  });

  it('enforces module ownership between provider types', async () => {
    const hotelFromTransport = await request(app)
      .post('/api/v1/provider/hotels')
      .set(auth(transport.accessToken))
      .send({ name: 'Not Allowed Hotel', destinationId });
    expect(hotelFromTransport.status).toBe(403);

    const vehicleFromGuide = await request(app)
      .post('/api/v1/provider/vehicles')
      .set(auth(guide.accessToken))
      .send({ name: 'Not Allowed Van', registrationNo: 'DHAKA-GA-00-0000', capacity: 4 });
    expect(vehicleFromGuide.status).toBe(403);

    const guideFromHotel = await request(app)
      .put('/api/v1/provider/guide')
      .set(auth(hotel.accessToken))
      .send({ dailyRate: 1000 });
    expect(guideFromHotel.status).toBe(403);

    const unknownRoom = await request(app)
      .patch('/api/v1/provider/rooms/999999')
      .set(auth(hotel.accessToken))
      .send({ basePrice: 100 });
    expect(unknownRoom.status).toBe(404);

    const noCategory = await request(app)
      .post('/api/v1/provider/vehicles')
      .set(auth(transport.accessToken))
      .send({ name: 'Uncategorised Van', registrationNo: 'DHAKA-CHA-00-1111', capacity: 8 });
    expect(noCategory.status).toBe(400);
    expect(noCategory.body.code).toBe('VEHICLE_CATEGORY_REQUIRED');
  });
});
