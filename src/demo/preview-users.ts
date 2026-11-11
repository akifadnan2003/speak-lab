import { DEFAULT_PREFERENCES, type AuthUser, type UserRole } from '@/features/auth/types'

/**
 * DEMO DATA (preview mode only).
 * These accounts exist only in the browser when `VITE_UI_PREVIEW=true` and Supabase is not
 * configured. They are not real users and carry no credentials.
 */
export const PREVIEW_USERS: Record<UserRole, AuthUser> = {
  tutor: {
    id: 'preview-tutor',
    email: 'tutor@preview.local',
    fullName: 'Akif (Tutor preview)',
    role: 'tutor',
    status: 'active',
    supportLanguage: 'none',
    preferredLanguage: 'en',
    preferences: DEFAULT_PREFERENCES,
    onboardingCompletedAt: '2026-10-01T00:00:00Z',
    createdAt: '2026-10-01T00:00:00Z',
  },
  student: {
    id: 'preview-student-1',
    email: 'student@preview.local',
    fullName: 'Aysel (Student preview)',
    role: 'student',
    status: 'active',
    supportLanguage: 'az',
    preferredLanguage: 'en',
    preferences: DEFAULT_PREFERENCES,
    onboardingCompletedAt: '2026-10-12T09:00:00Z',
    createdAt: '2026-10-12T09:00:00Z',
  },
}
