'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
const config = require('../config');
const { models } = require('../models');
const { sequelize } = require('./sequelize');

const DEMO_PASSWORD = config.seedDemoPassword || (config.isProd ? null : 'PothikDemo123');

function demoPassword() {
  if (!DEMO_PASSWORD) {
    throw new Error('SEED_DEMO_PASSWORD must be set before demo accounts can be seeded in production');
  }
  return DEMO_PASSWORD;
}

function dateOffset(days) {
  return dayjs.utc().add(days, 'day').format('YYYY-MM-DD');
}

async function findOrCreate(Model, where, defaults) {
  const existing = await Model.findOne({ where });
  if (existing) return { instance: existing, created: false };
  const instance = await Model.create({ ...defaults, ...where });
  return { instance, created: true };
}

async function ensureUser({ name, email, phone, role, status = 'ACTIVE', password = demoPassword(), locale = 'en' }) {
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

function demoPdf(text) {
  const content = `BT /F1 18 Tf 72 760 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return body;
}

function ensureDemoDocument() {
  const dir = path.join(config.uploads.dir, 'demo');
  const file = path.join(dir, 'trade-license.pdf');
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, demoPdf('POTHIK demo trade licence - not a real document'));
  return file;
}

module.exports = {
  DEMO_PASSWORD,
  dateOffset,
  findOrCreate,
  ensureUser,
  ensureProviderProfile,
  ensureDemoDocument,
  models,
  sequelize,
};
