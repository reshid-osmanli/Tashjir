import { defineConfig } from '@playwright/test';

const productionServer = process.env.PLAYWRIGHT_PRODUCTION === '1';
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: externalBaseURL || 'http://127.0.0.1:3000',
    viewport: { width: 1600, height: 1100 },
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--use-gl=angle', '--use-angle=swiftshader'],
    } : {},
  },
  ...(externalBaseURL ? {} : {
    webServer: {
      command: productionServer
        ? 'npm run start -- --hostname 0.0.0.0'
        : 'npm run dev -- --hostname 0.0.0.0',
      url: `${externalBaseURL || 'http://127.0.0.1:3000'}/editor`,
      reuseExistingServer: !process.env.CI && !productionServer,
      timeout: 120_000,
    },
  }),
});
