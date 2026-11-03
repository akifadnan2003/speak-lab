import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { useAuth } from './AuthProvider'
import type { UserRole } from './types'

/**
 * Route guards. Both fail closed: when there is no authenticated session the
 * user is sent to the login screen, and when the role does not match they are
 * sent to their own home. These guards are a UX layer only; real enforcement
 * happens in Row Level Security and Edge Functions (M2).
 */
export function RequireAuth() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') return <FullPageLoader label="Checking your session" />
  if (state.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (state.user.status === 'disabled') {
    return <Navigate to="/account-disabled" replace />
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
  if (state.status === 'authenticated') {
    return <Navigate to={homePathFor(state.user.role)} replace />
  }
  return <Outlet />
}

export function homePathFor(role: UserRole): string {
  return role === 'tutor' ? '/tutor' : '/'
}
