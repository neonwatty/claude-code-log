import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Claude Code Log Application
 * 
 * This configuration sets up comprehensive E2E testing with:
 * - Automatic dev server management (backend + frontend)
 * - Multiple browser testing
 * - Debug-friendly settings for manual validation
 * - Visual testing capabilities
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Run tests in files in parallel
  fullyParallel: false, // Disabled for debugging - enables sequential execution
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : 1, // Single worker for debugging
  
  // Reporter to use
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // Shared settings for all tests
  use: {
    // Base URL for tests
    baseURL: 'http://localhost:5173',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Record video on failure for debugging
    video: 'retain-on-failure',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Browser context options
    viewport: { width: 1280, height: 720 },
    
    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: true,
    
    // Permissions for local testing
    permissions: ['notifications'],
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      // Add any custom headers if needed
    },
  },
  
  // Global timeout for each test
  timeout: 60000, // 60 seconds for manual debugging
  
  // Global timeout for expect assertions
  expect: {
    // Timeout for assertions
    timeout: 10000, // 10 seconds
  },
  
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox', 
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Mobile testing (optional)
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // Web Server configuration - automatically start/stop dev servers
  webServer: [
    {
      // Backend server
      command: 'PORT=3002 npm run dev:backend',
      port: 3002,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // Frontend server  
      command: 'npm run dev:frontend',
      port: 5173,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe', 
      stderr: 'pipe',
    }
  ],
  
  // Global setup/teardown
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),
  
  // Output directory for test results
  outputDir: 'test-results/',
  
  // Test metadata
  metadata: {
    'test-suite': 'Claude Code Log E2E Tests',
    'version': '1.0.0',
    'environment': 'development'
  }
});