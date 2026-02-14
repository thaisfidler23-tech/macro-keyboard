// playwright.config.js - E2E Test Configuration
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for Macro Keyboard E2E tests
 * Supports cross-platform testing and comprehensive user workflow validation
 */
module.exports = defineConfig({
  testDir: './tests/e2e',
  
  /* Test timeouts */
  timeout: 60000,  // 60 seconds for complex workflows
  expect: {
    timeout: 10000  // 10 seconds for assertions
  },

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests for Electron apps (hardware simulation conflicts) */
  workers: process.env.CI ? 1 : 1,

  /* Reporter configuration */
  reporter: [
    ['html', { outputDir: 'tests/e2e/reports/html-report' }],
    ['json', { outputFile: 'tests/e2e/reports/test-results.json' }],
    ['junit', { outputFile: 'tests/e2e/reports/junit.xml' }],
    ['line']
  ],

  /* Global test configuration */
  use: {
    /* Base URL for web app tests (not needed for Electron) */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video recording for CI */
    video: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    
    /* Test execution context */
    testIdAttribute: 'data-testid'
  },

  /* Configure projects for major browsers (when testing web components) */
  projects: [
    {
      name: 'electron-main',
      testMatch: [
        'critical-paths/**/*.test.js',
        'user-journeys/**/*.test.js'
      ],
      use: {
        ...devices['Desktop Chrome'], // Base configuration
        // Electron-specific overrides will be handled by the test framework
      },
    },
    
    {
      name: 'cross-platform',
      testMatch: 'cross-platform/**/*.test.js',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    
    {
      name: 'regression',
      testMatch: 'regression/**/*.test.js',
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    {
      name: 'performance',
      testMatch: 'performance/**/*.test.js',
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    {
      name: 'accessibility',
      testMatch: 'accessibility/**/*.test.js',
      use: {
        ...devices['Desktop Chrome'],
      },
    }
  ],

  /* Global setup and teardown */
  globalSetup: require.resolve('./tests/e2e/global-setup.js'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.js'),

  /* Test directory structure */
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-results/',
});