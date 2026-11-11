/**
 * Hand-maintained row types for the tables the client reads. Keep in sync with
 * `supabase/migrations/*.sql`. Only the shapes the browser is allowed to see are listed.
 */
export type UserRole = 'tutor' | 'student'
export type AccountStatus = 'invited' | 'active' | 'disabled'
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'
export type SupportLanguage = 'az' | 'none'

export interface ProfileRow {
  id: string
  email: string
  full_name: string
  role: UserRole
  status: AccountStatus
  preferred_language: 'en'
  support_language: SupportLanguage
  preferences: Record<string, unknown>
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}

export type ProfileUpdate = Partial<
  Pick<ProfileRow, 'full_name' | 'preferred_language' | 'support_language' | 'preferences' | 'onboarding_completed_at'>
>

export interface TutorStudentRow {
  tutor_id: string
  student_id: string
  created_at: string
}

export interface InvitationRow {
  id: string
  email: string
  full_name: string
  user_id: string | null
  invited_by: string
  status: InvitationStatus
  sent_at: string
  expires_at: string
  resend_count: number
  accepted_at: string | null
  revoked_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface AccountEventRow {
  id: number
  user_id: string | null
  actor_id: string | null
  event_type:
    | 'owner_bootstrapped'
    | 'invitation_sent'
    | 'invitation_resent'
    | 'invitation_revoked'
    | 'invitation_accepted'
    | 'account_created'
    | 'account_disabled'
    | 'account_reactivated'
    | 'onboarding_completed'
  metadata: Record<string, unknown>
  created_at: string
}
