import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Testing Configuration
 * Comprehensive setup for end-to-end testing of the Video Generation Platform
 */
export default defineConfig({
  testDir: './e2e',

  /* Maximum time one test can run for. */
  timeout: 60 * 1000,

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', {
      outputFolder: 'test-results/playwright-report',
      open: 'never'
    }],
    ['json', {
      outputFile: 'test-results/playwright-results.json'
    }],
    ['junit', {
      outputFile: 'test-results/playwright-junit.xml'
    }],
    ['line']
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Global timeout for all actions */
    actionTimeout: 10 * 1000,

    /* Global timeout for navigation actions */
    navigationTimeout: 30 * 1000,

    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,

    /* Accept downloads */
    acceptDownloads: true,

    /* Viewport size */
    viewport: { width: 1280, height: 720 },

    /* User agent */
    userAgent: 'Playwright E2E Tests',

    /* Locale */
    locale: 'en-US',

    /* Timezone */
    timezoneId: 'America/New_York',

    /* Color scheme */
    colorScheme: 'light',

    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  },

  /* Global setup and teardown */
  globalSetup: require.resolve('./e2e/global-setup'),
  globalTeardown: require.resolve('./e2e/global-teardown'),

  /* Configure projects for major browsers */
  projects: [
    // Setup project
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },

    // Cleanup project
    {
      name: 'cleanup',
      testMatch: /.*\.teardown\.ts/,
    },

    // Desktop browsers
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
      dependencies: ['setup'],
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
      },
      dependencies: ['setup'],
    },

    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
      },
      dependencies: ['setup'],
    },

    // Branded browsers
    {
      name: 'Microsoft Edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge'
      },
      dependencies: ['setup'],
    },

    // API testing
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        // No browser context needed for API tests
        baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
      },
    },

    // Performance testing
    {
      name: 'performance',
      testMatch: /.*\.perf\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Performance-specific settings
        video: 'off',
        screenshot: 'off',
      },
      dependencies: ['setup'],
    },

    // Visual regression testing
    {
      name: 'visual',
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Ensure consistent rendering for visual tests
        deviceScaleFactor: 1,
        hasTouch: false,
      },
      dependencies: ['setup'],
    },

    // Accessibility testing
    {
      name: 'accessibility',
      testMatch: /.*\.a11y\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
    },
  ],

  /* Test directory and file patterns */
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
  ],

  /* Output directory for test results */
  outputDir: 'test-results/playwright-output',

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  testDir: './e2e',

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm run dev',
      cwd: './frontend',
      port: 5173,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev',
      cwd: './backend',
      port: 3000,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],

  /* Expect timeout for assertions */
  expect: {
    timeout: 10 * 1000,
    // Visual comparison threshold
    threshold: 0.1,
    // Animation handling
    toHaveScreenshot: {
      mode: 'css',
      animations: 'disabled',
    },
    toMatchSnapshot: {
      mode: 'css',
      animations: 'disabled',
    },
  },

  /* Test metadata */
  metadata: {
    platform: process.platform,
    environment: process.env.NODE_ENV || 'test',
    version: process.env.npm_package_version || '1.0.0',
  },
});
