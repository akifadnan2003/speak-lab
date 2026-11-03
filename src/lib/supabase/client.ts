import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/config/env'

/**
 * Lazily-created Supabase browser client.
 *
 * Only the public URL and anon key are ever used here. Privileged operations
 * (inviting users, role changes, AI calls) live in Edge Functions and are
 * never callable with this client alone. Returns `null` when the project is
 * not configured so callers can fail closed instead of throwing at import.
 */
let cached: SupabaseClient | null | undefined

export function getSupabaseClient(): SupabaseClient | null {
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
      detectSessionInUrl: true,
      storageKey: 'speaklab.auth',
    },
  })
  return cached
}
