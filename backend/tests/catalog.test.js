'use strict';

const { setupDatabase, closeDatabase } = require('./helpers/db');
const { request, app, login, auth } = require('./helpers/session');
const { today, addDays } = require('../src/shared/utils/dates');

jest.setTimeout(40000);

describe('public catalogue and admin catalogue management', () => {
  let admin;
  let hotel;
  let meta;
  let destination;
  let pkg;

  beforeAll(async () => {
    await setupDatabase();
    admin = await login('admin@pothik.test', process.env.ADMIN_PASSWORD);
    hotel = await login('hotel.owner@pothik.test', 'PothikDemo123');
    meta = (await request(app).get('/api/v1/destinations/meta')).body.data;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('lists and filters destinations', async () => {
    const list = await request(app).get('/api/v1/destinations').query({ limit: 20 });
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBeGreaterThanOrEqual(9);
    destination = list.body.data.items[0];

    const featured = await request(app).get('/api/v1/destinations').query({ featured: 'true' });
    expect(featured.status).toBe(200);
    expect(Array.isArray(featured.body.data.items)).toBe(true);

    const sorted = await request(app)
      .get('/api/v1/destinations')
      .query({ sort: 'rating', divisionId: meta.divisions[0].id, category: meta.categories[0].slug });
    expect(sorted.status).toBe(200);

    expect(meta.divisions.length).toBeGreaterThan(0);
    expect(meta.categories.length).toBeGreaterThan(0);

    const detail = await request(app).get(`/api/v1/destinations/${destination.slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.slug).toBe(destination.slug);

    const missing = await request(app).get('/api/v1/destinations/does-not-exist');
    expect(missing.status).toBe(404);
  });

  it('lists packages with filters and returns package detail', async () => {
    const list = await request(app).get('/api/v1/packages').query({ sort: 'price_asc', maxDays: 10, minPrice: 0 });
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBeGreaterThan(0);
    pkg = list.body.data.items[0];

    const filtered = await request(app).get('/api/v1/packages').query({ destination: destination.slug });
    expect(filtered.status).toBe(200);

    const detail = await request(app).get(`/api/v1/packages/${pkg.slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.departures.length).toBeGreaterThan(0);

    const missing = await request(app).get('/api/v1/packages/nope');
    expect(missing.status).toBe(404);
  });

  it('serves blog posts and search results', async () => {
    const blogs = await request(app).get('/api/v1/blogs').query({ limit: 3 });
    expect(blogs.status).toBe(200);
    expect(blogs.body.data.items.length).toBeGreaterThan(0);

    const detail = await request(app).get(`/api/v1/blogs/${blogs.body.data.items[0].slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.slug).toBe(blogs.body.data.items[0].slug);

    const missing = await request(app).get('/api/v1/blogs/nope');
    expect(missing.status).toBe(404);

    const search = await request(app).get('/api/v1/search').query({ q: 'cox' });
    expect(search.status).toBe(200);
    expect(search.body.data.totals.destinations + search.body.data.totals.packages).toBeGreaterThan(0);

    const tooShort = await request(app).get('/api/v1/search').query({ q: 'c' });
    expect(tooShort.status).toBe(422);
  });

  it('filters hotels, vehicles and guides and exposes availability', async () => {
    const hotels = await request(app).get('/api/v1/hotels').query({ sort: 'price_asc', minPrice: 0 });
    expect(hotels.status).toBe(200);
    expect(hotels.body.data.items.length).toBeGreaterThan(0);
    const slug = hotels.body.data.items[0].slug;

    const hotelDetail = await request(app).get(`/api/v1/hotels/${slug}`);
    expect(hotelDetail.status).toBe(200);

    const invalidWindow = await request(app).get(`/api/v1/hotels/${slug}/availability`).query({ rooms: 1 });
    expect(invalidWindow.status).toBe(422);

    const unavailable = await request(app).get('/api/v1/hotels/no-such-hotel/availability').query({ checkIn: addDays(today(), 5), checkOut: addDays(today(), 7) });
    expect(unavailable.status).toBe(404);

    const categories = await request(app).get('/api/v1/vehicle-categories');
    expect(categories.status).toBe(200);
    expect(categories.body.data.length).toBeGreaterThan(0);

    const vehicles = await request(app).get('/api/v1/vehicles').query({ minCapacity: 4, sort: 'capacity' });
    expect(vehicles.status).toBe(200);
    const vehicle = vehicles.body.data.items[0];

    const vehicleDetail = await request(app).get(`/api/v1/vehicles/${vehicle.id}`);
    expect(vehicleDetail.status).toBe(200);

    const vehicleAvailability = await request(app)
      .get(`/api/v1/vehicles/${vehicle.id}/availability`)
      .query({ startDate: addDays(today(), 5), endDate: addDays(today(), 7) });
    expect(vehicleAvailability.status).toBe(200);

    const guides = await request(app).get('/api/v1/guides').query({ minRating: 0, sort: 'rate_asc' });
    expect(guides.status).toBe(200);
    const guide = guides.body.data.items[0];

    const guideDetail = await request(app).get(`/api/v1/guides/${guide.id}`);
    expect(guideDetail.status).toBe(200);

    const guideAvailability = await request(app)
      .get(`/api/v1/guides/${guide.id}/availability`)
      .query({ startDate: addDays(today(), 5), endDate: addDays(today(), 7) });
    expect(guideAvailability.status).toBe(200);

    const missingVehicle = await request(app).get('/api/v1/vehicles/999999');
    expect(missingVehicle.status).toBe(404);
  });

  it('has at least one published hotel for every destination', async () => {
    const destinations = await request(app).get('/api/v1/destinations').query({ limit: 50 });
    expect(destinations.status).toBe(200);

    const missing = [];
    for (const item of destinations.body.data.items) {
      const hotels = await request(app).get('/api/v1/hotels').query({ destination: item.slug, limit: 8 });
      expect(hotels.status).toBe(200);
      if (hotels.body.data.items.length === 0) missing.push(item.slug);
    }
    expect(missing).toEqual([]);
  });

  it('lets admins manage destinations and packages', async () => {
    const created = await request(app)
      .post('/api/v1/admin/destinations')
      .set(auth(admin.accessToken))
      .send({
        name: 'Jest Test Island',
        districtId: meta.divisions[0].districts[0].id,
        categoryId: meta.categories[0].id,
        summary: 'Created by an integration test',
        status: 'PUBLISHED',
        featured: false,
      });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .patch(`/api/v1/admin/destinations/${created.body.data.id}`)
      .set(auth(admin.accessToken))
      .send({ summary: 'Updated summary', featured: true });
    expect(updated.status).toBe(200);
    expect(updated.body.data.summary).toBe('Updated summary');

    const archived = await request(app)
      .delete(`/api/v1/admin/destinations/${created.body.data.id}`)
      .set(auth(admin.accessToken));
    expect(archived.status).toBe(200);
    expect(archived.body.data.archived).toBe(true);

    const packageCreated = await request(app)
      .post('/api/v1/admin/packages')
      .set(auth(admin.accessToken))
      .send({
        title: 'Jest Test Package',
        durationDays: 3,
        durationNights: 2,
        pricePerPerson: 12500,
        maxCapacity: 12,
        destinationIds: [destination.id],
        departures: [{ startDate: addDays(today(), 30), endDate: addDays(today(), 32), capacity: 12 }],
        status: 'PUBLISHED',
      });
    expect(packageCreated.status).toBe(201);
    expect(packageCreated.body.data.slug).toBe('jest-test-package');

    const packageUpdated = await request(app)
      .patch(`/api/v1/admin/packages/${packageCreated.body.data.id}`)
      .set(auth(admin.accessToken))
      .send({ pricePerPerson: 13500, featured: true });
    expect(packageUpdated.status).toBe(200);
    expect(Number(packageUpdated.body.data.base_price_per_person)).toBe(13500);

    const forbidden = await request(app)
      .post('/api/v1/admin/destinations')
      .set(auth(hotel.accessToken))
      .send({ name: 'Not Allowed', districtId: meta.divisions[0].districts[0].id });
    expect(forbidden.status).toBe(403);
  });
});
