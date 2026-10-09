import { defineConfig } from '@playwright/test';

// E2E_PRODUCTION=1  → run against `next start` (production build), which is
//                      what Vercel Preview deployments serve.
// E2E_BASE_URL=...  → run against an already-running server (e.g. a Vercel
//                      Preview URL) and skip the local webServer entirely.
const production = process.env.E2E_PRODUCTION === '1';
const externalBaseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  workers: 1,
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:3000',
    viewport: { width: 1600, height: 1100 },
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--use-gl=angle', '--use-angle=swiftshader'],
    } : {},
  },
  webServer: externalBaseURL ? undefined : {
    command: production
      ? 'npm run start -- --hostname 0.0.0.0'
      : 'npm run dev -- --hostname 0.0.0.0',
    url: 'http://127.0.0.1:3000/editor',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
