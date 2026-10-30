'use strict';

/**
 * Migration / seeder runner (Umzug on top of Sequelize).
 *
 *   node src/database/cli.js migrate
 *   node src/database/cli.js rollback --to 0
 *   node src/database/cli.js seed
 *   node src/database/cli.js setup       (migrate + seed)
 *   node src/database/cli.js reset       (dev only: drop schema, migrate, seed)
 */
const path = require('path');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const config = require('../config');
const { sequelize } = require('./sequelize');

function buildUmzug(kind) {
  const isSeeder = kind === 'seed';
  return new Umzug({
    migrations: {
      glob: [isSeeder ? 'seeders/*.js' : 'migrations/*.js', { cwd: __dirname }],
      resolve: ({ name, path: filePath, context }) => {
        // eslint-disable-next-line global-require, import/no-dynamic-require
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
    logger: {
      info: (event) => {
        if (event.event === 'migrated' || event.event === 'reverted') {
          console.log(`  ${event.event}: ${event.name}`);
        }
      },
      warn: (event) => console.warn(`  warn: ${event.message || event.event}`),
      error: (event) => console.error(`  error: ${event.message || event.event}`),
      debug: () => {},
    },
  });
}

async function run() {
  const command = process.argv[2] || 'migrate';
  const toIndex = process.argv.indexOf('--to');
  const to = toIndex > -1 ? process.argv[toIndex + 1] : undefined;

  await sequelize.authenticate();
  console.log(`Connected: dialect=${config.db.dialect} database=${config.db.name}`);

  if (command === 'migrate') {
    console.log('Running migrations');
    await buildUmzug('migrate').up();
    console.log('Migrations complete');
  } else if (command === 'rollback') {
    const umzug = buildUmzug('migrate');
    if (to === '0' || to === 'all' || to === undefined) {
      console.log(`Rolling back${to === '0' || to === 'all' ? ' everything' : ' one step'}`);
      const steps = to === undefined ? 1 : (await umzug.executed()).length;
      for (let i = 0; i < steps; i += 1) await umzug.down();
    } else {
      console.log(`Rolling back to ${to}`);
      await umzug.down({ to });
    }
    console.log('Rollback complete');
  } else if (command === 'seed') {
    console.log('Running seeders');
    await buildUmzug('seed').up();
    console.log('Seeders complete');
  } else if (command === 'setup') {
    await buildUmzug('migrate').up();
    await buildUmzug('seed').up();
    console.log('Database setup complete');
  } else if (command === 'reset') {
    if (config.isProd) throw new Error('reset is not allowed in production');
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    for (const table of tables) {
      const name = typeof table === 'string' ? table : table.tableName || table.TABLE_NAME;
      if (name) await queryInterface.dropTable(name, { cascade: true });
    }
    await buildUmzug('migrate').up();
    await buildUmzug('seed').up();
    console.log('Database reset complete');
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
}

run()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err.message);
    if (process.env.DEBUG_CLI) console.error(err);
    try {
      await sequelize.close();
    } catch (closeErr) {
      /* ignore */
    }
    process.exit(1);
  });
