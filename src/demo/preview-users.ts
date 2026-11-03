import type { AuthUser, UserRole } from '@/features/auth/types'

/**
 * DEMO DATA (M1 preview mode only).
 * These accounts exist only in the browser when `VITE_UI_PREVIEW=true`.
 * They are not real users and carry no credentials.
 */
export const PREVIEW_USERS: Record<UserRole, AuthUser> = {
  tutor: {
    id: 'preview-tutor',
    email: 'tutor@preview.local',
    fullName: 'Akif (Tutor preview)',
    role: 'tutor',
    status: 'active',
  },
  student: {
    id: 'preview-student-1',
    email: 'student@preview.local',
    fullName: 'Aysel (Student preview)',
    role: 'student',
    status: 'active',
  },
}
