import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { useAuth } from './AuthProvider'
import { AuthErrorScreen } from './AuthErrorScreen'
import type { UserRole } from './types'

/**
 * Redirect that re-fires on every location change. React Router's built-in redirect component
 * only re-runs its effect when the *target* changes, so a guard element that stays mounted across
 * two quick navigations (e.g. /tutor then /tutor/students/x) would silently stop redirecting and
 * leave a blank screen at the protected URL. Keying on `location.key` closes that gap.
 */
export function Redirect({ to }: { to: string }) {
  const navigate = useNavigate()
  const { key } = useLocation()
  useEffect(() => {
    navigate(to, { replace: true })
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `key` is the intended trigger
  }, [navigate, to, key])
  return null
}

/**
 * Route guards. All fail closed: no session → login; wrong role → the user's own home;
 * profile unavailable → an error screen with sign-out. They are a UX layer; the real
 * enforcement is Row Level Security and the Edge Function role check.
 */
export function RequireAuth() {
  const { state } = useAuth()

  if (state.status === 'loading') return <FullPageLoader label="Checking your session" />
  if (state.status === 'error') return <AuthErrorScreen message={state.message} />
  if (state.status !== 'authenticated') {
    return <Redirect to="/login" />
  }
  if (state.user.status === 'disabled') {
    return <Redirect to="/account-disabled" />
  }
  return <Outlet />
}

/** Students must finish onboarding (password + preferences) before using the app shell. */
export function RequireOnboarded() {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return <Redirect to="/login" />
  if (state.user.role === 'student' && !state.user.onboardingCompletedAt) {
    return <Redirect to="/welcome" />
  }
  return <Outlet />
}

export function RequireRole({ role }: { role: UserRole }) {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return <Redirect to="/login" />
  if (state.user.role !== role) {
    return <Redirect to={homePathFor(state.user.role)} />
  }
  return <Outlet />
}

/** Redirects a signed-in user away from auth screens. */
export function RedirectIfAuthenticated() {
  const { state } = useAuth()
  if (state.status === 'loading') return <FullPageLoader label="Checking your session" />
  if (state.status === 'authenticated') {
    if (state.user.status === 'disabled') return <Redirect to="/account-disabled" />
    return <Redirect to={homePathFor(state.user.role)} />
  }
  return <Outlet />
}

export function homePathFor(role: UserRole): string {
  return role === 'tutor' ? '/tutor' : '/'
}
