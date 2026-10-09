import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 1600, height: 1100 },
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--use-gl=angle', '--use-angle=swiftshader'],
    } : {},
  },
  // بناء إنتاجي لا وضع تطوير: فاحص الهويات (وكل ما يختبره e2e) يجب أن
  // يعمل كما يعمل على Vercel Preview — NODE_ENV=production — لا في dev فقط.
  webServer: {
    command: 'npm run build && npm run start -- --hostname 0.0.0.0 --port 3000',
    url: 'http://127.0.0.1:3000/editor',
    reuseExistingServer: !process.env.CI,
    timeout: 420_000,
  },
});
