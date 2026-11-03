/* oxlint-disable react/only-export-components -- route configuration module, not a component file */
import { lazy } from 'react'
import { createHashRouter, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { RedirectIfAuthenticated, RequireAuth, RequireRole } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { RoleHome } from './RoleHome'

/*
 * Feature screens are code-split per route so phones download only what the
 * current screen needs. `AppShell` wraps the outlet in <Suspense>.
 */
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
)
const AuthCallbackPage = lazy(() =>
  import('@/features/auth/AuthStatusPages').then((m) => ({ default: m.AuthCallbackPage })),
)
const AccountDisabledPage = lazy(() =>
  import('@/features/auth/AuthStatusPages').then((m) => ({ default: m.AccountDisabledPage })),
)
const LearnPage = lazy(() => import('@/features/learn/LearnPage').then((m) => ({ default: m.LearnPage })))
const ChapterPage = lazy(() => import('@/features/learn/ChapterPage').then((m) => ({ default: m.ChapterPage })))
const LessonWorkspacePage = lazy(() =>
  import('@/features/lesson/LessonWorkspacePage').then((m) => ({ default: m.LessonWorkspacePage })),
)
const SpeakPage = lazy(() => import('@/features/speak/SpeakPage').then((m) => ({ default: m.SpeakPage })))
const SpeakSessionPage = lazy(() =>
  import('@/features/speak/SpeakSessionPage').then((m) => ({ default: m.SpeakSessionPage })),
)
const VocabularyPage = lazy(() =>
  import('@/features/vocabulary/VocabularyPage').then((m) => ({ default: m.VocabularyPage })),
)
const VocabularyPracticePage = lazy(() =>
  import('@/features/vocabulary/VocabularyPracticePage').then((m) => ({ default: m.VocabularyPracticePage })),
)
const ProgressPage = lazy(() => import('@/features/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const MyStudentsPage = lazy(() => import('@/features/tutor/MyStudentsPage').then((m) => ({ default: m.MyStudentsPage })))
const StudentDetailPage = lazy(() =>
  import('@/features/tutor/StudentDetailPage').then((m) => ({ default: m.StudentDetailPage })),
)
const TutorCurriculumPage = lazy(() =>
  import('@/features/tutor/TutorCurriculumPage').then((m) => ({ default: m.TutorCurriculumPage })),
)
const NotFoundPage = lazy(() => import('@/features/errors/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

/**
 * Hash routing is used deliberately: GitHub Pages serves a static `index.html`
 * only at the project root, so `#/learn/...` survives refresh and direct
 * navigation without a 404 redirect hack. See docs/DECISIONS.md (ADR-003).
 */
export const routes: RouteObject[] = [
  {
    element: <AuthLayout />,
    children: [
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
      { path: '/account-disabled', element: <AccountDisabledPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <RoleHome /> },
          { path: '/settings', element: <SettingsPage /> },
          {
            element: <RequireRole role="student" />,
            children: [
              { path: '/learn', element: <LearnPage /> },
              { path: '/learn/:chapterId', element: <ChapterPage /> },
              { path: '/learn/:chapterId/lessons/:lessonId', element: <LessonWorkspacePage /> },
              { path: '/speak', element: <SpeakPage /> },
              { path: '/speak/:modeId', element: <SpeakSessionPage /> },
              { path: '/vocabulary', element: <VocabularyPage /> },
              { path: '/vocabulary/practice/:modeId', element: <VocabularyPracticePage /> },
              { path: '/progress', element: <ProgressPage /> },
            ],
          },
          {
            element: <RequireRole role="tutor" />,
            children: [
              { path: '/tutor', element: <MyStudentsPage /> },
              { path: '/tutor/curriculum', element: <TutorCurriculumPage /> },
              { path: '/tutor/students/:studentId', element: <StudentDetailPage /> },
              { path: '/tutor/students/:studentId/:section', element: <StudentDetailPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export const router = createHashRouter(routes)
