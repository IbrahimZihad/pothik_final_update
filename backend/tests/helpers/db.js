'use strict';

/**
 * Integration-test harness. Every suite gets its own SQLite file built by the
 * real Umzug migrations and seeders, so tests exercise the same schema the app
 * ships with. Set DB_DIALECT=mysql in the environment to run the same suites
 * against a disposable MySQL database instead.
 */

const fs = require('fs');
const path = require('path');

if (!process.env.DB_DIALECT) process.env.DB_DIALECT = 'sqlite';
if (process.env.DB_DIALECT === 'sqlite' && !process.env.SQLITE_STORAGE) {
  process.env.SQLITE_STORAGE = path.join('tmp', `jest-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 100000)}.sqlite`);
}
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pothik.test';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminDemoPass123';
process.env.SEED_DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'PothikDemo123';

const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const config = require('../../src/config');

const DATABASE_DIR = path.join(__dirname, '..', '..', 'src', 'database');

function buildUmzug(kind) {
  const { sequelize } = require('../../src/database/sequelize');
  const isSeeder = kind === 'seed';
  return new Umzug({
    migrations: {
      glob: [isSeeder ? 'seeders/*.js' : 'migrations/*.js', { cwd: DATABASE_DIR }],
      resolve: ({ name, path: filePath, context }) => {
        const migration = require(filePath);
        return {
          name,
          up: async () => migration.up({ context }),
          down: async () => migration.down({ context }),
        };
      },
    },
    context: { queryInterface: sequelize.getQueryInterface(), Sequelize, sequelize, config },
    storage: new SequelizeStorage({
      sequelize,
      tableName: isSeeder ? 'sequelize_seed_meta' : 'sequelize_meta',
      modelName: isSeeder ? 'SequelizeSeedMeta' : 'SequelizeMeta',
    }),
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  });
}

async function setupDatabase() {
  const { sequelize } = require('../../src/database/sequelize');
  if (config.db.dialect === 'sqlite') {
    const storage = process.env.SQLITE_STORAGE;
    if (storage && storage !== ':memory:' && fs.existsSync(storage)) fs.rmSync(storage, { force: true });
  }
  await sequelize.authenticate();
  await buildUmzug('migrate').up();
  await buildUmzug('seed').up();
  return sequelize;
}

async function closeDatabase() {
  const { sequelize } = require('../../src/database/sequelize');
  await sequelize.close();
  if (config.db.dialect === 'sqlite') {
    const storage = process.env.SQLITE_STORAGE;
    if (storage && storage !== ':memory:' && fs.existsSync(storage)) fs.rmSync(storage, { force: true });
  }
}

module.exports = { setupDatabase, closeDatabase };
