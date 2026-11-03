import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_PATH = '/speak-lab/'

/**
 * End-to-end tests run against the production build served by `vite preview`
 * so the GitHub Pages base path, hash routing and PWA manifest are exercised
 * exactly as deployed. Preview mode is enabled so the UI shells render with
 * clearly-labelled demo data (see docs/TESTING.md).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
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
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_UI_PREVIEW: 'true' },
  },
})
