import type { AppSupabaseClient } from '@/lib/supabase/client'
import type { ProfileRow } from '@/lib/supabase/database.types'
import { DEFAULT_PREFERENCES, type AuthUser, type StudentPreferences } from './types'

export const PROFILE_QUERY_KEY = ['auth', 'profile'] as const

export function parsePreferences(raw: Record<string, unknown> | null | undefined): StudentPreferences {
  const value = raw ?? {}
  const feedbackStyle = typeof value['feedbackStyle'] === 'string' ? value['feedbackStyle'] : DEFAULT_PREFERENCES.feedbackStyle
  const minutes = Number(value['dailySpeakingMinutes'])
  const dailySpeakingMinutes =
    Number.isFinite(minutes) && minutes >= 5 && minutes <= 120 ? Math.round(minutes) : DEFAULT_PREFERENCES.dailySpeakingMinutes
  const showSupportLanguage =
    typeof value['showSupportLanguage'] === 'boolean' ? value['showSupportLanguage'] : DEFAULT_PREFERENCES.showSupportLanguage
  return { feedbackStyle, dailySpeakingMinutes, showSupportLanguage }
}

export function mapProfile(row: ProfileRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    supportLanguage: row.support_language,
    preferredLanguage: row.preferred_language,
    preferences: parsePreferences(row.preferences),
    onboardingCompletedAt: row.onboarding_completed_at,
    createdAt: row.created_at,
  }
}

export class ProfileLoadError extends Error {
  readonly kind: 'missing' | 'network'
  constructor(message: string, kind: 'missing' | 'network') {
    super(message)
    this.kind = kind
  }
}

/** Loads the caller's own profile row. RLS guarantees only that row is visible. */
export async function fetchOwnProfile(client: AppSupabaseClient, userId: string): Promise<AuthUser> {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new ProfileLoadError(error.message, 'network')
  if (!data) throw new ProfileLoadError('Your account has no profile yet. Contact your tutor.', 'missing')
  return mapProfile(data as ProfileRow)
}
