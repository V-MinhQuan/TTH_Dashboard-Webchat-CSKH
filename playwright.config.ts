import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Primary desktop browser
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Responsive viewports (used by 10-responsive.spec.ts)
    {
      name: 'viewport-1920',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
      testMatch: '**/10-responsive.spec.ts',
    },
    {
      name: 'viewport-1536',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1536, height: 864 } },
      testMatch: '**/10-responsive.spec.ts',
    },
    {
      name: 'viewport-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: '**/10-responsive.spec.ts',
    },
    {
      name: 'viewport-1366',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
      testMatch: '**/10-responsive.spec.ts',
    },
    {
      name: 'viewport-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      testMatch: '**/10-responsive.spec.ts',
    },
    {
      name: 'viewport-1024',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
      testMatch: '**/10-responsive.spec.ts',
    },
    {
      name: 'viewport-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
      testMatch: '**/10-responsive.spec.ts',
    },
  ],
});
