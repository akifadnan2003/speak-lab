/**
 * Authentication domain types.
 *
 * `UserRole` is the only role vocabulary in the app. Roles are *never* derived
 * from client-side data in production: M2 will read them from a `profiles`
 * row protected by Row Level Security and enforced by Edge Functions.
 */
export type UserRole = 'tutor' | 'student'

export type AccountStatus = 'active' | 'disabled' | 'invited'

export interface AuthUser {
  readonly id: string
  readonly email: string
  readonly fullName: string
  readonly role: UserRole
  readonly status: AccountStatus
  readonly avatarUrl?: string | null
}

export type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'unauthenticated'; readonly reason: 'no-session' | 'unconfigured' }
  | { readonly status: 'authenticated'; readonly user: AuthUser; readonly preview: boolean }

export interface AuthContextValue {
  readonly state: AuthState
  readonly signOut: () => Promise<void>
  /** Preview-only helper (M1). Switches the fake session role. No-op in production. */
  readonly previewSwitchRole?: (role: UserRole) => void
}
