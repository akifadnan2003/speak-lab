import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PreviewBanner } from '@/components/feedback/PreviewBanner'
import { useAuth } from '@/features/auth/AuthProvider'
import { BottomNav } from './BottomNav'
import { DesktopSidebar } from './Sidebar'
import { TopBar } from './TopBar'

/**
 * Authenticated application frame.
 * - >= lg: fixed sidebar + top bar + spacious content column.
 * - < lg: top bar with drawer + bottom navigation, safe-area aware.
 */
export function AppShell() {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return null
  const { user } = state

  return (
    <div className="min-h-dvh bg-canvas">
      <a href="#main-content" className="sr-only-focusable rounded-lg bg-primary px-3 py-2 text-sm text-fg-on-primary">
        Skip to content
      </a>
      <DesktopSidebar role={user.role} />
      <div className="flex min-h-dvh flex-col lg:pl-sidebar">
        <PreviewBanner />
        <TopBar user={user} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-[calc(var(--bottomnav-height)+var(--safe-bottom)+1.5rem)] outline-none sm:px-6 sm:pt-6 lg:px-8 lg:pb-10"
        >
          <Suspense fallback={<FullPageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav role={user.role} />
    </div>
  )
}
