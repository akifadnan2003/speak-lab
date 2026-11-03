import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Brand } from './Brand'

/** Centered, single-column frame for sign-in and account screens. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas" style={{ paddingTop: 'var(--safe-top)' }}>
      <header className="flex h-topbar items-center justify-between px-4 sm:px-6">
        <Brand to="/login" />
        <ThemeToggle />
      </header>
      <main
        id="main-content"
        className="flex flex-1 items-start justify-center px-4 pt-6 pb-[calc(2rem+var(--safe-bottom))] sm:items-center sm:pt-0"
      >
        <div className="w-full max-w-md animate-slide-up">
          <Suspense fallback={<FullPageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <footer className="px-4 pb-[calc(1rem+var(--safe-bottom))] text-center text-xs text-fg-subtle">
        SpeakLab is invitation-only. Ask your tutor for access.
      </footer>
    </div>
  )
}
