import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { env } from '@/config/env'
import { PREVIEW_USERS } from '@/demo/preview-users'
import type { AuthContextValue, AuthState, UserRole } from './types'

const AuthContext = createContext<AuthContextValue | null>(null)

const PREVIEW_ROLE_KEY = 'speaklab.preview.role'

function readPreviewRole(): UserRole {
  try {
    const stored = sessionStorage.getItem(PREVIEW_ROLE_KEY)
    if (stored === 'tutor' || stored === 'student') return stored
  } catch {
    /* storage unavailable */
  }
  return 'student'
}

/**
 * AuthProvider (M1)
 *
 * Until Supabase auth ships in M2 this provider has exactly two behaviours:
 *
 * 1. Production / unconfigured: the state is `unauthenticated` with reason
 *    `unconfigured` (no Supabase env) or `no-session`. Guards fail closed.
 * 2. Preview mode (`VITE_UI_PREVIEW=true`): a fake local session is created so
 *    the UI shells can be reviewed. It is flagged `preview: true`, surfaced by
 *    a persistent banner, and never touches a network.
 *
 * M2 replaces the preview branch with a real Supabase session listener while
 * keeping this context shape so screens do not change.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [previewRole, setPreviewRole] = useState<UserRole>(() => readPreviewRole())
  const [previewSignedOut, setPreviewSignedOut] = useState(false)

  const state = useMemo<AuthState>(() => {
    if (env.uiPreview && !previewSignedOut) {
      return { status: 'authenticated', user: PREVIEW_USERS[previewRole], preview: true }
    }
    return {
      status: 'unauthenticated',
      reason: env.supabaseConfigured ? 'no-session' : 'unconfigured',
    }
  }, [previewRole, previewSignedOut])

  const signOut = useCallback(async () => {
    if (env.uiPreview) {
      setPreviewSignedOut(true)
      return
    }
    // M2: await getSupabaseClient()?.auth.signOut()
  }, [])

  const previewSwitchRole = useCallback((role: UserRole) => {
    if (!env.uiPreview) return
    try {
      sessionStorage.setItem(PREVIEW_ROLE_KEY, role)
    } catch {
      /* storage unavailable */
    }
    setPreviewSignedOut(false)
    setPreviewRole(role)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signOut,
      previewSwitchRole: env.uiPreview ? previewSwitchRole : undefined,
    }),
    [state, signOut, previewSwitchRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

/** Convenience accessor for the signed-in user or null. */
export function useCurrentUser() {
  const { state } = useAuth()
  return state.status === 'authenticated' ? state.user : null
}
