import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the production build (vite preview).
 *
 * The build is pointed at fake hosts (api.test, supabase.test), and every
 * request to them — and to Turnstile — is intercepted in e2e/fixtures.ts, so
 * the suite never touches real data or needs secrets. Environment variables
 * set here take priority over any local .env file.
 */
const PORT = 4174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_API_BASE_URL: 'http://api.test',
      VITE_SUPABASE_URL: 'http://supabase.test',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      // Cloudflare's documented always-pass test site key; the widget script
      // itself is stubbed in fixtures.ts.
      VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    },
  },
});
