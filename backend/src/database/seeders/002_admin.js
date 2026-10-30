'use strict';

const config = require('../../config');
const { ensureUser } = require('../seedUtils');

module.exports = {
  async up() {
    if (!config.admin.email || !config.admin.password) {
      console.log('  admin account skipped: set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) in .env to create it');
      return;
    }
    if (config.admin.password.length < 10) {
      throw new Error('ADMIN_PASSWORD must be at least 10 characters');
    }
    await ensureUser({
      name: config.admin.name,
      email: config.admin.email,
      role: 'ADMIN',
      password: config.admin.password,
      status: 'ACTIVE',
    });
    console.log(`  admin account ensured for ${config.admin.email}`);
  },
};
