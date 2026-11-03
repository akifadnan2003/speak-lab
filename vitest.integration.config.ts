import { defineConfig } from 'vitest/config'

/**
 * Integration tests that need a running local Supabase stack (`npx supabase start`).
 * They talk to Postgres/GoTrue/Edge Functions over HTTP, so no jsdom and no mocks.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    sequence: { concurrent: false },
    reporters: process.env.CI ? ['dot'] : ['default'],
  },
})
