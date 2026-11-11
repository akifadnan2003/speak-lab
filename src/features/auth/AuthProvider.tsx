import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { env } from '@/config/env'
import { PREVIEW_USERS } from '@/demo/preview-users'
import { activateLocalUser, clearLocalStudentData, deactivateLocalUser } from '@/lib/local-data'
import { getSupabaseClient, type AppSupabaseClient } from '@/lib/supabase/client'
import { authErrorCode, describeAuthError } from './auth-errors'
import { consumeAuthRedirect, type AuthRedirect } from './auth-url'
import { fetchOwnProfile, PROFILE_QUERY_KEY, ProfileLoadError } from './profile'
import type { AuthContextValue, AuthFlow, AuthState, UserRole } from './types'

const AuthContext = createContext<AuthContextValue | null>(null)

/** How often the own profile is re-read so a disabled account is noticed without a reload. */
const PROFILE_REFRESH_MS = 60_000

/**
 * AuthProvider
 *
 * Real builds use `SupabaseAuthProvider`: a session listener, the caller's `profiles` row
 * (role, status, name, preferences) and processing of email links captured at boot.
 *
 * `PreviewAuthProvider` exists only for `VITE_UI_PREVIEW=true` builds, which `config/env.ts`
 * refuses whenever Supabase is configured. It creates a fake local session over labelled demo
 * data for screen review and tests, and never touches a network.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (env.uiPreview) return <PreviewAuthProvider>{children}</PreviewAuthProvider>
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
}

// ---------------------------------------------------------------------------------------------
// Real provider
// ---------------------------------------------------------------------------------------------

async function applyRedirect(client: AppSupabaseClient, redirect: AuthRedirect): Promise<Session | null> {
  switch (redirect.kind) {
    case 'token_hash': {
      const { data, error } = await client.auth.verifyOtp({ token_hash: redirect.tokenHash, type: redirect.type })
      if (error) throw error
      return data.session
    }
    case 'code': {
      const { data, error } = await client.auth.exchangeCodeForSession(redirect.code)
      if (error) throw error
      return data.session
    }
    case 'error': {
      const err = new Error(redirect.description)
      ;(err as Error & { code: string }).code = redirect.code
      throw err
    }
  }
}

function flowTypeOf(redirect: AuthRedirect): Exclude<AuthFlow['type'], 'error'> {
  if (redirect.kind === 'error') return 'signin'
  return redirect.type ?? 'signin'
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getSupabaseClient(), [])
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  // Email links captured before the router mounted (invitation, recovery, ...).
  const [redirect] = useState<AuthRedirect | null>(() => consumeAuthRedirect())
  const [flow, setFlow] = useState<AuthFlow | null>(() => {
    if (!redirect) return null
    if (!client) {
      return { status: 'error', type: flowTypeOf(redirect), code: 'unconfigured', message: 'Authentication is not configured in this build.' }
    }
    return { status: 'processing', type: flowTypeOf(redirect) }
  })
  const redirectHandled = useRef(false)

  useEffect(() => {
    if (!client) return
    let cancelled = false

    const { data: subscription } = client.auth.onAuthStateChange((event, next) => {
      if (cancelled) return
      setSession(next)
      if (event === 'SIGNED_OUT') {
        // Session revoked, expired or signed out elsewhere: nothing of the student stays on the device.
        queryClient.clear()
        void clearLocalStudentData().then(deactivateLocalUser)
      }
    })

    if (redirect && !redirectHandled.current) {
      redirectHandled.current = true
      const type = flowTypeOf(redirect)
      void applyRedirect(client, redirect)
        .then((next) => {
          if (next) setSession(next)
          setFlow({ status: 'complete', type })
        })
        .catch((error: unknown) => {
          const code = redirect.kind === 'error' ? redirect.code : authErrorCode(error)
          setFlow({ status: 'error', type: redirect.kind === 'error' ? 'error' : type, code, message: describeAuthError(error) })
        })
    }

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [client, queryClient, redirect])

  const userId = session?.user.id ?? null

  // Shared devices: before anything is read for a user, make sure no data from a *different*
  // previous account remains on the device. The profile query waits for this scoping step.
  const [scopedUserId, setScopedUserId] = useState<string | null>(null)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void activateLocalUser(userId).then((purged) => {
      if (cancelled) return
      if (purged) queryClient.clear()
      setScopedUserId(userId)
    })
    return () => {
      cancelled = true
    }
  }, [userId, queryClient])
  const scoped = userId !== null && scopedUserId === userId

  const profileQuery = useQuery({
    queryKey: [...PROFILE_QUERY_KEY, userId],
    queryFn: () => fetchOwnProfile(client!, userId!),
    enabled: Boolean(client && scoped),
    staleTime: 15_000,
    refetchInterval: PROFILE_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: (count, error) => !(error instanceof ProfileLoadError && error.kind === 'missing') && count < 2,
  })

  const signOut = useCallback(async () => {
    if (!client) return
    // `scope: 'global'` (default) revokes every refresh token for this user server-side.
    const { error } = await client.auth.signOut()
    if (error) {
      // Even if the server call fails (offline), drop the local session so the UI locks.
      await client.auth.signOut({ scope: 'local' })
    }
    setSession(null)
    setScopedUserId(null)
    queryClient.clear()
    await clearLocalStudentData()
    deactivateLocalUser()
  }, [client, queryClient])

  const refreshProfile = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY })
  }, [queryClient])

  const clearFlow = useCallback(() => setFlow(null), [])

  const state = useMemo<AuthState>(() => {
    if (!client) return { status: 'unauthenticated', reason: 'unconfigured' }
    if (flow?.status === 'processing') return { status: 'loading' }
    if (session === undefined) return { status: 'loading' }
    if (session === null) return { status: 'unauthenticated', reason: 'no-session' }
    if (!scoped) return { status: 'loading' }
    if (profileQuery.data) return { status: 'authenticated', user: profileQuery.data, preview: false }
    if (profileQuery.isError) return { status: 'error', message: describeAuthError(profileQuery.error) }
    return { status: 'loading' }
  }, [client, flow, session, scoped, profileQuery.data, profileQuery.isError, profileQuery.error])

  const value = useMemo<AuthContextValue>(
    () => ({ state, flow, clearFlow, signOut, refreshProfile }),
    [state, flow, clearFlow, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------------------------
// Preview provider (development / tests only)
// ---------------------------------------------------------------------------------------------

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

function PreviewAuthProvider({ children }: { children: ReactNode }) {
  const [previewRole, setPreviewRole] = useState<UserRole>(() => readPreviewRole())
  const [signedOut, setSignedOut] = useState(false)

  const state = useMemo<AuthState>(() => {
    if (!signedOut) return { status: 'authenticated', user: PREVIEW_USERS[previewRole], preview: true }
    return { status: 'unauthenticated', reason: 'no-session' }
  }, [previewRole, signedOut])

  const signOut = useCallback(async () => {
    setSignedOut(true)
    await clearLocalStudentData()
  }, [])
  const refreshProfile = useCallback(async () => {}, [])
  const clearFlow = useCallback(() => {}, [])
  const previewSwitchRole = useCallback((role: UserRole) => {
    try {
      sessionStorage.setItem(PREVIEW_ROLE_KEY, role)
    } catch {
      /* storage unavailable */
    }
    setSignedOut(false)
    setPreviewRole(role)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ state, flow: null, clearFlow, signOut, refreshProfile, previewSwitchRole }),
    [state, clearFlow, signOut, refreshProfile, previewSwitchRole],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------------------------

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
