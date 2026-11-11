import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
/**
 * The client is left untyped on purpose: row shapes live in `database.types.ts` and are applied
 * at each query boundary, which keeps the hand-written types independent of supabase-js generics.
 */
export type AppSupabaseClient = SupabaseClient

/**
 * Lazily-created Supabase browser client.
 *
 * Only the public URL and publishable key are ever used here. Privileged operations (inviting
 * users, role or status changes, AI calls) live in Edge Functions and are never possible with
 * this client alone. Returns `null` when the project is not configured so callers fail closed.
 *
 * `detectSessionInUrl` is off on purpose: email links land on GitHub Pages where the hash
 * belongs to the router, so `src/features/auth/auth-url.ts` extracts and consumes auth
 * parameters itself before the router mounts.
 */
let cached: AppSupabaseClient | null | undefined

export function getSupabaseClient(): AppSupabaseClient | null {
  if (cached !== undefined) return cached
  if (!env.supabaseConfigured || !env.supabaseUrl || !env.supabaseAnonKey) {
    cached = null
    return cached
  }
  cached = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'speaklab.auth',
    },
  })
  return cached
}

/** Test seam: forget the cached client so a new configuration can be picked up. */
export function resetSupabaseClientForTests(): void {
  cached = undefined
}
