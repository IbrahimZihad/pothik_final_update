import { defineConfig, devices } from '@playwright/test';

const API_PORT = Number(process.env.E2E_API_PORT || 5100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5180);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm --prefix ../backend run db:setup && npm --prefix ../backend start',
      url: `http://localhost:${API_PORT}/api/v1/health/ready`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        APP_URL: `http://localhost:${WEB_PORT}`,
        API_URL: `http://localhost:${API_PORT}`,
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        DB_DIALECT: 'sqlite',
        SQLITE_STORAGE: 'tmp/e2e.sqlite',
        JWT_ACCESS_SECRET: 'e2e-access-secret-not-for-production',
        JWT_REFRESH_SECRET: 'e2e-refresh-secret-not-for-production',
        PAYMENT_CALLBACK_SECRET: 'e2e-callback-secret',
        ADMIN_EMAIL: 'admin@pothik.test',
        ADMIN_PASSWORD: 'PothikE2eAdmin123',
        SEED_DEMO_PASSWORD: 'PothikDemo123',
        QUEUE_ENABLED: 'false',
      },
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_URL: `http://localhost:${API_PORT}/api/v1` },
    },
  ],
});
