'use strict';

const { setupDatabase, closeDatabase } = require('./helpers/db');
const { request, app, login, auth } = require('./helpers/session');

jest.setTimeout(60000);

describe('authorization and ownership', () => {
  let customer;
  let hotel;
  let admin;

  beforeAll(async () => {
    await setupDatabase();
    customer = await login('customer@pothik.test', 'PothikDemo123');
    hotel = await login('hotel.owner@pothik.test', 'PothikDemo123');
    admin = await login('admin@pothik.test', process.env.ADMIN_PASSWORD);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('returns 401 for missing or invalid access tokens', async () => {
    const missing = await request(app).get('/api/v1/bookings');
    expect(missing.status).toBe(401);
    expect(missing.body.success).toBe(false);

    const invalid = await request(app).get('/api/v1/bookings').set(auth('not-a-real-token'));
    expect(invalid.status).toBe(401);
  });

  it('blocks customers from admin and provider APIs', async () => {
    const adminUsers = await request(app).get('/api/v1/admin/users').set(auth(customer.accessToken));
    expect(adminUsers.status).toBe(403);

    const adminBookings = await request(app).get('/api/v1/admin/bookings').set(auth(customer.accessToken));
    expect(adminBookings.status).toBe(403);

    const providerHotels = await request(app).get('/api/v1/provider/hotels').set(auth(customer.accessToken));
    expect(providerHotels.status).toBe(403);

    const providerDashboard = await request(app).get('/api/v1/provider/dashboard').set(auth(customer.accessToken));
    expect(providerDashboard.status).toBe(403);
  });

  it('blocks providers from admin APIs and from other provider modules', async () => {
    const adminUsers = await request(app).get('/api/v1/admin/users').set(auth(hotel.accessToken));
    expect(adminUsers.status).toBe(403);

    const vehicles = await request(app).get('/api/v1/vehicles');
    const vehicleId = vehicles.body.data.items[0].id;
    const crossModule = await request(app)
      .patch(`/api/v1/provider/vehicles/${vehicleId}`)
      .set(auth(hotel.accessToken))
      .send({ capacity: 5 });
    expect(crossModule.status).toBe(403);
  });

  it('does not expose another customer’s booking', async () => {
    const packages = await request(app).get('/api/v1/packages');
    const packageSlug = packages.body.data.items[0].slug;
    const detail = (await request(app).get(`/api/v1/packages/${packageSlug}`)).body.data;
    const departureId = detail.departures[0].id;

    const created = await request(app)
      .post('/api/v1/bookings')
      .set(auth(customer.accessToken))
      .send({
        type: 'PACKAGE',
        composition: { adults: 1, package: { packageId: detail.id, departureId } },
        contact: { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' },
      });
    expect(created.status).toBe(201);

    const email = `stranger.${Date.now()}@pothik.test`;
    const stranger = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Stranger Danger', email, password: 'Travel2000!' });

    const fetched = await request(app)
      .get(`/api/v1/bookings/${created.body.data.reference}`)
      .set(auth(stranger.body.data.accessToken));
    expect(fetched.status).toBe(404);

    const mine = await request(app)
      .get(`/api/v1/bookings/${created.body.data.reference}`)
      .set(auth(customer.accessToken));
    expect(mine.status).toBe(200);
  });

  it('rejects provider actions on bookings without their own line', async () => {
    const packages = await request(app).get('/api/v1/packages');
    const detail = (await request(app).get(`/api/v1/packages/${packages.body.data.items[0].slug}`)).body.data;
    const departureId = detail.departures[0].id;

    const created = await request(app)
      .post('/api/v1/bookings')
      .set(auth(customer.accessToken))
      .send({
        type: 'PACKAGE',
        composition: { adults: 1, package: { packageId: detail.id, departureId } },
        contact: { name: 'Ayesha Rahman', phone: '01611112222', email: 'customer@pothik.test' },
      });

    const accepted = await request(app)
      .post(`/api/v1/provider/bookings/${created.body.data.reference}/accept`)
      .set(auth(hotel.accessToken));
    expect(accepted.status).toBe(404);

    const rejected = await request(app)
      .post(`/api/v1/provider/bookings/${created.body.data.reference}/reject`)
      .set(auth(hotel.accessToken))
      .send({ reason: 'Not ours' });
    expect(rejected.status).toBe(404);
  });

  it('lets an admin read any booking and provider-scoped detail for participants', async () => {
    const bookings = await request(app).get('/api/v1/admin/bookings').set(auth(admin.accessToken));
    expect(bookings.status).toBe(200);
    expect(bookings.body.data.items.length).toBeGreaterThan(0);

    const reference = bookings.body.data.items[0].reference;
    const detail = await request(app).get(`/api/v1/admin/bookings/${reference}`).set(auth(admin.accessToken));
    expect(detail.status).toBe(200);
    expect(detail.body.data.reference).toBe(reference);
  });
});
