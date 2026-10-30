'use strict';

const { setupDatabase, closeDatabase } = require('./helpers/db');
const { request, app, login, auth } = require('./helpers/session');

jest.setTimeout(30000);

describe('auth', () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('rejects malformed registrations with field errors', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors.map((row) => row.field)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('registers a customer and returns a usable access token', async () => {
    const email = `new.customer.${Date.now()}@pothik.test`;
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Nadia Islam', email, password: 'Travel2000!', phone: '01655556666' });

    expect(registered.status).toBe(201);
    expect(registered.body.data.user.email).toBe(email);
    expect(registered.body.data.user.roles).toEqual(expect.arrayContaining(['CUSTOMER']));
    expect(registered.body.data.accessToken).toBeTruthy();
    expect(registered.body.data.user.password_hash).toBeUndefined();
    expect(registered.body.data.user.passwordHash).toBeUndefined();

    const me = await request(app).get('/api/v1/auth/me').set(auth(registered.body.data.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
  });

  it('refuses duplicate emails and non-customer registrations without a business name', async () => {
    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Ayesha Rahman', email: 'customer@pothik.test', password: 'Travel2000!' });
    expect(duplicate.status).toBe(409);

    const provider = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Provider User', email: `provider.${Date.now()}@pothik.test`, password: 'Travel2000!', role: 'HOTEL_OWNER' });
    expect(provider.status).toBe(422);
    expect(provider.body.errors.some((row) => row.field === 'businessName')).toBe(true);
  });

  it('registers a provider account in PENDING state', async () => {
    const email = `owner.${Date.now()}@pothik.test`;
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'New Owner', email, password: 'Travel2000!', role: 'HOTEL_OWNER', businessName: 'New Owner Resort' });

    expect(registered.status).toBe(201);
    expect(registered.body.data.user.roles).toEqual(expect.arrayContaining(['HOTEL_OWNER']));
    expect(registered.body.data.user.providerProfile.type).toBe('HOTEL');
    expect(registered.body.data.user.providerProfile.status).toBe('PENDING');
  });

  it('rejects bad passwords and suspended accounts', async () => {
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: 'customer@pothik.test', password: 'wrong-password' });
    expect(wrong.status).toBe(401);

    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@pothik.test', password: 'Travel2000!' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).not.toMatch(/password hash/i);
  });

  it('rotates refresh tokens and detects reuse of a revoked token', async () => {
    const session = await login('customer@pothik.test', 'PothikDemo123');

    const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).not.toBe(session.refreshToken);

    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.message).toMatch(/reuse/i);

    const familyKilled = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refreshed.body.data.refreshToken });
    expect(familyKilled.status).toBe(401);
  });

  it('logs out by revoking the current refresh token', async () => {
    const session = await login('guide@pothik.test', 'PothikDemo123');
    const logout = await request(app).post('/api/v1/auth/logout').send({ refreshToken: session.refreshToken });
    expect(logout.status).toBe(200);

    const afterLogout = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it('updates the profile and changes the password', async () => {
    const email = `profile.${Date.now()}@pothik.test`;
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Profile User', email, password: 'Travel2000!' });
    const token = registered.body.data.accessToken;

    const updated = await request(app)
      .patch('/api/v1/auth/me')
      .set(auth(token))
      .send({ name: 'Profile User Updated', locale: 'bn', travel_preferences: { budget: 'mid' } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Profile User Updated');
    expect(updated.body.data.locale).toBe('bn');

    const changed = await request(app)
      .post('/api/v1/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'Travel2000!', newPassword: 'Travel2001!' });
    expect(changed.status).toBe(200);

    const oldPassword = await request(app).post('/api/v1/auth/login').send({ email, password: 'Travel2000!' });
    expect(oldPassword.status).toBe(401);
    const newPassword = await request(app).post('/api/v1/auth/login').send({ email, password: 'Travel2001!' });
    expect(newPassword.status).toBe(200);
  });

  it('never leaks password hashes or internal ids in /auth/me', async () => {
    const session = await login('hotel.owner@pothik.test', 'PothikDemo123');
    const me = await request(app).get('/api/v1/auth/me').set(auth(session.accessToken));
    expect(me.status).toBe(200);
    const serialized = JSON.stringify(me.body);
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/token_hash/i);
  });
});
