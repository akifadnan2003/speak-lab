import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { useAuth } from './AuthProvider'
import { AuthErrorScreen } from './AuthErrorScreen'
import type { UserRole } from './types'

/**
 * Route guards. All fail closed: no session → login; wrong role → the user's own home;
 * profile unavailable → an error screen with sign-out. They are a UX layer; the real
 * enforcement is Row Level Security and the Edge Function role check.
 */
export function RequireAuth() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') return <FullPageLoader label="Checking your session" />
  if (state.status === 'error') return <AuthErrorScreen message={state.message} />
  if (state.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (state.user.status === 'disabled') {
    return <Navigate to="/account-disabled" replace />
  }
  return <Outlet />
}

/** Students must finish onboarding (password + preferences) before using the app shell. */
export function RequireOnboarded() {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return <Navigate to="/login" replace />
  if (state.user.role === 'student' && !state.user.onboardingCompletedAt) {
    return <Navigate to="/welcome" replace />
  }
  return <Outlet />
}

export function RequireRole({ role }: { role: UserRole }) {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return <Navigate to="/login" replace />
  if (state.user.role !== role) {
    return <Navigate to={homePathFor(state.user.role)} replace />
  }
  return <Outlet />
}

/** Redirects a signed-in user away from auth screens. */
export function RedirectIfAuthenticated() {
  const { state } = useAuth()
  if (state.status === 'loading') return <FullPageLoader label="Checking your session" />
  if (state.status === 'authenticated') {
    if (state.user.status === 'disabled') return <Navigate to="/account-disabled" replace />
    return <Navigate to={homePathFor(state.user.role)} replace />
  }
  return <Outlet />
}

export function homePathFor(role: UserRole): string {
  return role === 'tutor' ? '/tutor' : '/'
}
