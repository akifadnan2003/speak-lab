import { z } from 'zod'

/**
 * Runtime configuration parsed once from `import.meta.env`.
 *
 * - Supabase values are the public project URL and the *publishable* (anon) key only. Both are
 *   safe in the bundle: every table is protected by Row Level Security and privileged work runs
 *   in Edge Functions with server-side secrets.
 * - When Supabase values are absent the app runs in "unconfigured" mode: protected routes fail
 *   closed and the login screen explains that auth is not connected.
 * - `uiPreview` is a development/test-only switch that renders the screens with a fake local
 *   session over labelled demo data. It is refused whenever Supabase is configured, so a real
 *   build can never show simulated access (see docs/SECURITY.md).
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.union([z.url(), z.literal('')]).optional(),
  VITE_SUPABASE_ANON_KEY: z.string().optional(),
  VITE_UI_PREVIEW: z.string().optional(),
  VITE_BASE_PATH: z.string().optional(),
})

export interface AppEnv {
  readonly supabaseUrl: string | null
  readonly supabaseAnonKey: string | null
  readonly supabaseConfigured: boolean
  readonly uiPreview: boolean
  readonly basePath: string
  readonly isDev: boolean
}

function truthy(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export function parseEnv(raw: Record<string, string | undefined>, isDev: boolean): AppEnv {
  const parsed = envSchema.safeParse(raw)
  const data = parsed.success ? parsed.data : {}
  if (!parsed.success) {
    console.warn('[speaklab] Invalid environment configuration; falling back to defaults.')
  }
  const supabaseUrl = data.VITE_SUPABASE_URL ? data.VITE_SUPABASE_URL : null
  const supabaseAnonKey = data.VITE_SUPABASE_ANON_KEY ? data.VITE_SUPABASE_ANON_KEY : null
  const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
  const previewRequested = truthy(data.VITE_UI_PREVIEW)
  if (previewRequested && supabaseConfigured) {
    console.warn('[speaklab] VITE_UI_PREVIEW is ignored because Supabase is configured.')
  }
  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseConfigured,
    uiPreview: previewRequested && !supabaseConfigured,
    basePath: data.VITE_BASE_PATH || '/speak-lab/',
    isDev,
  }
}

export const env: AppEnv = parseEnv(
  {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_UI_PREVIEW: import.meta.env.VITE_UI_PREVIEW,
    VITE_BASE_PATH: import.meta.env.VITE_BASE_PATH,
  },
  import.meta.env.DEV,
)
