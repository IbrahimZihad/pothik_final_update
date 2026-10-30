'use strict';

const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
const config = require('../config');
const { models } = require('../models');
const { sequelize } = require('./sequelize');

const DEMO_PASSWORD = config.seedDemoPassword || 'PothikDemo123';

function dateOffset(days) {
  return dayjs.utc().add(days, 'day').format('YYYY-MM-DD');
}

async function findOrCreate(Model, where, defaults) {
  const existing = await Model.findOne({ where });
  if (existing) return { instance: existing, created: false };
  const instance = await Model.create({ ...defaults, ...where });
  return { instance, created: true };
}

async function ensureUser({ name, email, phone, role, status = 'ACTIVE', password = DEMO_PASSWORD, locale = 'en' }) {
  const password_hash = await bcrypt.hash(password, config.bcryptRounds);
  const [user, created] = await models.User.findOrCreate({
    where: { email },
    defaults: {
      name,
      email,
      phone,
      password_hash,
      status,
      email_verified_at: status === 'ACTIVE' ? new Date() : null,
      locale,
    },
  });
  if (created) {
    const roleRow = await models.Role.findOne({ where: { code: role } });
    if (roleRow) await models.UserRole.findOrCreate({ where: { user_id: user.id }, defaults: { role_id: roleRow.id } });
  }
  return user;
}

async function ensureProviderProfile({ userId, type, businessName, description, phone, address, status = 'APPROVED' }) {
  const [profile] = await models.ProviderProfile.findOrCreate({
    where: { user_id: userId },
    defaults: {
      user_id: userId,
      type,
      business_name: businessName,
      description,
      phone,
      address,
      status,
      approved_at: status === 'APPROVED' ? new Date() : null,
    },
  });
  return profile;
}

module.exports = { DEMO_PASSWORD, dateOffset, findOrCreate, ensureUser, ensureProviderProfile, models, sequelize };
