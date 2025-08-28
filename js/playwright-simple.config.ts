import { defineConfig, devices } from '@playwright/test';

/**
 * Simple Playwright Configuration for Basic Testing
 * No automatic server management - assumes servers are running
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  
  reporter: [['list'], ['json', { outputFile: 'test-results/simple-results.json' }]],
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  
  timeout: 30000,
  expect: { timeout: 10000 },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  
  // No webServer config - assume servers are running
  outputDir: 'test-results/',
});