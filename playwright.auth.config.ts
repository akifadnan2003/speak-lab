import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_PATH = '/'

/**
 * Real-authentication end-to-end tests. The production bundle is built against the LOCAL
 * Supabase stack (`supabase start`), so invitation and recovery emails are real GoTrue emails
 * captured by Mailpit, and the links are opened exactly as a student would open them.
 *
 * Required env: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (local values) and
 * optionally MAILPIT_URL. `npm run test:e2e:auth` reads them from `supabase status`.
 */
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.API_URL ?? ''
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? ''

export default defineConfig({
  testDir: './e2e',
  testMatch: /auth\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-auth' }]] : [['list']],
  globalSetup: './e2e/auth.setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_UI_PREVIEW: 'false',
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: anonKey,
    },
  },
})
