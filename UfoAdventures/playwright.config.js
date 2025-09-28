const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npx http-server src -p 5173 -c-1 --silent',
    url: 'http://127.0.0.1:5173/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
