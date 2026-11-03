import { lazy } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { homePathFor } from '@/features/auth/guards'

const StudentHomePage = lazy(() =>
  import('@/features/dashboard/StudentHomePage').then((m) => ({ default: m.StudentHomePage })),
)

/** Sends each role to its own home. Tutors do not use the student dashboard. */
export function RoleHome() {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return <Navigate to="/login" replace />
  if (state.user.role === 'tutor') return <Navigate to={homePathFor('tutor')} replace />
  return <StudentHomePage />
}
