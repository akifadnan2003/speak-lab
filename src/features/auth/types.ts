import type { AccountStatus, SupportLanguage, UserRole } from '@/lib/supabase/database.types'
import type { AuthFlowType } from './auth-url'

export type { AccountStatus, SupportLanguage, UserRole }

/**
 * Authentication domain types.
 *
 * `role` and `status` come from the caller's `profiles` row, which is written only by the
 * database (triggers, owner bootstrap) and the `student-admin` Edge Function. Clients cannot
 * change them, so the UI can trust them for navigation while Row Level Security remains the
 * real enforcement.
 */
export interface StudentPreferences {
  readonly feedbackStyle: string
  readonly dailySpeakingMinutes: number
  readonly showSupportLanguage: boolean
}

export const DEFAULT_PREFERENCES: StudentPreferences = {
  feedbackStyle: 'gentle',
  dailySpeakingMinutes: 15,
  showSupportLanguage: true,
}

export interface AuthUser {
  readonly id: string
  readonly email: string
  readonly fullName: string
  readonly role: UserRole
  readonly status: AccountStatus
  readonly avatarUrl?: string | null
  readonly supportLanguage: SupportLanguage
  readonly preferredLanguage: 'en'
  readonly preferences: StudentPreferences
  readonly onboardingCompletedAt: string | null
  readonly createdAt: string
}

/**
 * Progress of an email link (invitation, recovery) being turned into a session. `null` when no
 * link is being processed. The callback screen renders from this.
 */
export type AuthFlow =
  | { readonly status: 'processing'; readonly type: AuthFlowType | 'signin' }
  | { readonly status: 'complete'; readonly type: AuthFlowType | 'signin' }
  | { readonly status: 'error'; readonly type: AuthFlowType | 'signin' | 'error'; readonly code: string; readonly message: string }

export type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'unauthenticated'; readonly reason: 'no-session' | 'unconfigured' }
  | {
      /** A session exists but the profile could not be loaded (network, missing row). Fail closed. */
      readonly status: 'error'
      readonly message: string
    }
  | { readonly status: 'authenticated'; readonly user: AuthUser; readonly preview: boolean }

export interface AuthContextValue {
  readonly state: AuthState
  readonly flow: AuthFlow | null
  readonly clearFlow: () => void
  readonly signOut: () => Promise<void>
  /** Re-reads the profile row (after onboarding, settings changes, status checks). */
  readonly refreshProfile: () => Promise<void>
  /** Preview-only helper. Switches the fake session role. Undefined in real builds. */
  readonly previewSwitchRole?: (role: UserRole) => void
}
