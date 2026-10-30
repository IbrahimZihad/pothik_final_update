'use strict';

require('./db');

const request = require('supertest');
const app = require('../../src/app');

async function login(email, password) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.data;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, request, login, auth };
