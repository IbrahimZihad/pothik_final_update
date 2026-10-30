'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const path = require('path');
const { z } = require('zod');

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

const TEST_ONLY = {
  JWT_ACCESS_SECRET: 'test-only-access-secret-not-for-production-use',
  JWT_REFRESH_SECRET: 'test-only-refresh-secret-not-for-production-use',
};

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  APP_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:5000'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  DB_DIALECT: z.enum(['mysql', 'sqlite']).default('mysql'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default('pothik_dev'),
  DB_USER: z.string().default('pothik_app'),
  DB_PASSWORD: z.string().default(''),
  DB_LOGGING: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),

  JWT_ACCESS_SECRET: z.string().min(isProd ? 32 : 10).default(isTest ? TEST_ONLY.JWT_ACCESS_SECRET : ''),
  JWT_REFRESH_SECRET: z.string().min(isProd ? 32 : 10).default(isTest ? TEST_ONLY.JWT_REFRESH_SECRET : ''),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  REDIS_URL: z.string().optional().default(''),
  QUEUE_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  PAYMENT_GATEWAY: z.enum(['demo', 'sslcommerz']).default('demo'),
  PAYMENT_CALLBACK_SECRET: z.string().default(isTest ? 'test-callback-secret' : ''),
  SSLCOMMERZ_STORE_ID: z.string().optional().default(''),
  SSLCOMMERZ_STORE_PASSWORD: z.string().optional().default(''),
  SSLCOMMERZ_SANDBOX: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),

  PLATFORM_COMMISSION_RATE: z.coerce.number().min(0).max(100).default(10),
  HOTEL_COMMISSION_RATE: z.coerce.number().min(0).max(100).default(12),
  TRANSPORT_COMMISSION_RATE: z.coerce.number().min(0).max(100).default(10),
  GUIDE_COMMISSION_RATE: z.coerce.number().min(0).max(100).default(10),

  ADMIN_EMAIL: z
    .string()
    .optional()
    .default('')
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Invalid email'),
  ADMIN_PASSWORD: z.string().optional().default(''),
  ADMIN_NAME: z.string().default('Platform Administrator'),

  UPLOAD_DIR: z.string().default(path.join(__dirname, '..', '..', 'uploads')),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().positive().default(20),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
  SEED_DEMO_PASSWORD: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration -> ${issues}`);
}

const env = parsed.data;

if (env.NODE_ENV !== 'test' && (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET)) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set (see .env.example)');
}
if (isProd && env.PAYMENT_GATEWAY === 'demo') {
  throw new Error('PAYMENT_GATEWAY=demo is forbidden in production');
}
if (isProd && env.NODE_ENV === 'production' && !env.SEED_DEMO_PASSWORD) {
  // demo seeding stays available in production only through an explicit env-provided secret
  env.SEED_DEMO_PASSWORD = '';
}

const config = {
  env: env.NODE_ENV,
  isTest,
  isProd,
  port: env.PORT,
  apiPrefix: env.API_PREFIX,
  appUrl: env.APP_URL,
  apiUrl: env.API_URL,
  corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  db: {
    dialect: env.DB_DIALECT,
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    logging: env.DB_LOGGING,
    poolMax: env.DB_POOL_MAX,
  },
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.ACCESS_TOKEN_TTL,
    refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  },
  redisUrl: env.REDIS_URL,
  queueEnabled: env.QUEUE_ENABLED && Boolean(env.REDIS_URL),
  payments: {
    gateway: env.PAYMENT_GATEWAY,
    callbackSecret: env.PAYMENT_CALLBACK_SECRET,
    sslcommerz: {
      storeId: env.SSLCOMMERZ_STORE_ID,
      storePassword: env.SSLCOMMERZ_STORE_PASSWORD,
      sandbox: env.SSLCOMMERZ_SANDBOX,
    },
  },
  commission: {
    default: env.PLATFORM_COMMISSION_RATE,
    hotel: env.HOTEL_COMMISSION_RATE,
    transport: env.TRANSPORT_COMMISSION_RATE,
    guide: env.GUIDE_COMMISSION_RATE,
  },
  admin: {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    name: env.ADMIN_NAME,
  },
  uploads: {
    dir: env.UPLOAD_DIR,
    maxBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.RATE_LIMIT_MAX,
    authMax: env.AUTH_RATE_LIMIT_MAX,
  },
  bcryptRounds: env.BCRYPT_ROUNDS,
  seedDemoPassword: env.SEED_DEMO_PASSWORD,
};

module.exports = config;
