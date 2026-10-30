'use strict';

const { setupDatabase, closeDatabase } = require('./helpers/db');
const { request, app, login, auth } = require('./helpers/session');

jest.setTimeout(40000);

describe('admin moderation and dashboards', () => {
  let admin;
  let customer;
  let hotel;
  let transport;

  beforeAll(async () => {
    await setupDatabase();
    admin = await login('admin@pothik.test', process.env.ADMIN_PASSWORD);
    customer = await login('customer@pothik.test', 'PothikDemo123');
    hotel = await login('hotel.owner@pothik.test', 'PothikDemo123');
    transport = await login('transport@pothik.test', 'PothikDemo123');
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('reports platform statistics with a six-month revenue series', async () => {
    const stats = await request(app).get('/api/v1/admin/stats').set(auth(admin.accessToken));
    expect(stats.status).toBe(200);
    expect(stats.body.data.bookings.total).toBeGreaterThan(0);
    expect(stats.body.data.revenue.series).toHaveLength(6);
  });

  it('suspends and reactivates users without letting an admin self-suspend', async () => {
    const users = await request(app).get('/api/v1/admin/users').set(auth(admin.accessToken));
    expect(users.status).toBe(200);
    const pendingUser = users.body.data.items.find((row) => row.email === 'pending.hotel@pothik.test');
    expect(pendingUser).toBeTruthy();

    const selfSuspend = await request(app)
      .patch(`/api/v1/admin/users/${admin.user.id}/status`)
      .set(auth(admin.accessToken))
      .send({ status: 'SUSPENDED' });
    expect(selfSuspend.status).toBe(400);
    expect(selfSuspend.body.code).toBe('SELF_STATUS_CHANGE');

    const suspended = await request(app)
      .patch(`/api/v1/admin/users/${pendingUser.id}/status`)
      .set(auth(admin.accessToken))
      .send({ status: 'SUSPENDED', reason: 'Test suspension' });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.status).toBe('SUSPENDED');

    const blockedLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pending.hotel@pothik.test', password: 'PothikDemo123' });
    expect(blockedLogin.status).toBe(401);

    const reactivated = await request(app)
      .patch(`/api/v1/admin/users/${pendingUser.id}/status`)
      .set(auth(admin.accessToken))
      .send({ status: 'ACTIVE' });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.data.status).toBe('ACTIVE');
  });

  it('approves and rejects provider applications with an audit trail', async () => {
    const providers = await request(app)
      .get('/api/v1/admin/providers')
      .query({ status: 'PENDING' })
      .set(auth(admin.accessToken));
    expect(providers.status).toBe(200);
    expect(providers.body.data.items.length).toBeGreaterThanOrEqual(2);

    const pendingHotel = providers.body.data.items.find((row) => row.type === 'HOTEL');
    const pendingGuide = providers.body.data.items.find((row) => row.type === 'GUIDE');

    const approved = await request(app)
      .post(`/api/v1/admin/providers/${pendingHotel.id}/approve`)
      .set(auth(admin.accessToken))
      .send({ commissionRate: 15 });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.commissionRate).toBe(15);

    const rejected = await request(app)
      .post(`/api/v1/admin/providers/${pendingGuide.id}/reject`)
      .set(auth(admin.accessToken))
      .send({ reason: 'Documents illegible' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');

    const document = approved.body.data.documents?.[0];
    if (document) {
      const reviewed = await request(app)
        .patch(`/api/v1/admin/providers/${pendingHotel.id}/documents/${document.id}`)
        .set(auth(admin.accessToken))
        .send({ status: 'VERIFIED', notes: 'Checked against trade licence registry' });
      expect(reviewed.status).toBe(200);
    }

    const audits = await request(app).get('/api/v1/admin/audit-logs').set(auth(admin.accessToken));
    expect(audits.status).toBe(200);
    expect(audits.body.data.items.some((row) => row.action === 'provider.approve')).toBe(true);
    expect(audits.body.data.items.some((row) => row.action === 'provider.reject')).toBe(true);
  });

  it('manages coupons without hard-deleting them', async () => {
    const created = await request(app)
      .post('/api/v1/admin/coupons')
      .set(auth(admin.accessToken))
      .send({ code: 'jest15', type: 'PERCENT', value: 15, maxDiscount: 1500, minSpend: 3000, perUserLimit: 2 });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe('JEST15');

    const duplicate = await request(app)
      .post('/api/v1/admin/coupons')
      .set(auth(admin.accessToken))
      .send({ code: 'JEST15', type: 'FIXED', value: 100 });
    expect(duplicate.status).toBe(409);

    const updated = await request(app)
      .patch(`/api/v1/admin/coupons/${created.body.data.id}`)
      .set(auth(admin.accessToken))
      .send({ usageLimit: 300, isActive: true });
    expect(updated.status).toBe(200);
    expect(updated.body.data.usageLimit).toBe(300);

    const deactivated = await request(app)
      .delete(`/api/v1/admin/coupons/${created.body.data.id}`)
      .set(auth(admin.accessToken));
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.isActive).toBe(false);
  });

  it('moderates reviews through the review service', async () => {
    const reviews = await request(app).get('/api/v1/admin/reviews').set(auth(admin.accessToken));
    expect(reviews.status).toBe(200);
    expect(reviews.body.data.items.length).toBeGreaterThan(0);
    const review = reviews.body.data.items[0];

    const rejected = await request(app)
      .post(`/api/v1/admin/reviews/${review.id}/moderate`)
      .set(auth(admin.accessToken))
      .send({ status: 'REJECTED' });
    expect(rejected.body.data.status).toBe('REJECTED');

    const approved = await request(app)
      .post(`/api/v1/admin/reviews/${review.id}/moderate`)
      .set(auth(admin.accessToken))
      .send({ status: 'APPROVED' });
    expect(approved.body.data.status).toBe('APPROVED');
  });

  it('creates, publishes and archives blog posts', async () => {
    const created = await request(app)
      .post('/api/v1/admin/blogs')
      .set(auth(admin.accessToken))
      .send({ title: 'Jest travel guide', excerpt: 'Temporary post', content: 'Body', status: 'DRAFT' });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('jest-travel-guide');

    const published = await request(app)
      .patch(`/api/v1/admin/blogs/${created.body.data.id}`)
      .set(auth(admin.accessToken))
      .send({ status: 'PUBLISHED' });
    expect(published.body.data.status).toBe('PUBLISHED');
    expect(published.body.data.publishedAt).toBeTruthy();

    const archived = await request(app)
      .delete(`/api/v1/admin/blogs/${created.body.data.id}`)
      .set(auth(admin.accessToken));
    expect(archived.body.data.status).toBe('DRAFT');
  });

  it('serves provider and customer dashboards to the right roles', async () => {
    const hotelDash = await request(app).get('/api/v1/provider/dashboard').set(auth(hotel.accessToken));
    expect(hotelDash.status).toBe(200);
    expect(hotelDash.body.data.type).toBe('HOTEL');
    expect(hotelDash.body.data.finance).toBeTruthy();

    const transportDash = await request(app).get('/api/v1/provider/dashboard').set(auth(transport.accessToken));
    expect(transportDash.status).toBe(200);
    expect(transportDash.body.data.type).toBe('TRANSPORT');

    const customerDash = await request(app).get('/api/v1/dashboard').set(auth(customer.accessToken));
    expect(customerDash.status).toBe(200);
    expect(customerDash.body.data.bookings).toBeTruthy();
  });
});
