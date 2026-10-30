'use strict';

const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const config = require('../config');
const logger = require('../config/logger');

const sequelizeOptions = {
  dialect: config.db.dialect,
  logging: config.db.logging ? (sql) => logger.debug({ sql }, 'sequelize') : false,
  define: {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  pool: { max: config.db.poolMax, min: 0, acquire: 30000, idle: 10000 },
};

let sequelize;

if (config.db.dialect === 'sqlite') {
  const storage = process.env.SQLITE_STORAGE || path.join(__dirname, '..', '..', 'tmp', 'dev.sqlite');
  if (storage !== ':memory:') fs.mkdirSync(path.dirname(storage), { recursive: true });
  sequelize = new Sequelize({
    ...sequelizeOptions,
    storage,
    pool: { max: 1, min: 0, idle: 10000 },
    retry: { max: 10 },
  });
} else {
  sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    ...sequelizeOptions,
    host: config.db.host,
    port: config.db.port,
    timezone: '+00:00',
    dialectOptions: {
      decimalNumbers: false,
      supportBigNumbers: true,
      bigNumberStrings: true,
      charset: 'utf8mb4',
    },
  });
}

async function closeConnection() {
  await sequelize.close();
}

module.exports = { sequelize, closeConnection };
