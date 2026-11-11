import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppEnv } from '@/config/env'

const mockEnv: { env: AppEnv } = {
  env: {
    supabaseUrl: null,
    supabaseAnonKey: null,
    supabaseConfigured: false,
    uiPreview: false,
    basePath: '/speak-lab/',
    isDev: false,
  },
}

vi.mock('@/config/env', () => mockEnv)

// The service-worker virtual module is not available under Vitest.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, vi.fn()], updateServiceWorker: vi.fn() }),
}))

async function renderAt(path: string) {
  const { routes } = await import('./router')
  const { AuthProvider } = await import('@/features/auth/AuthProvider')
  const { TooltipProvider } = await import('@/components/ui/tooltip')
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>,
  )
  return router
}

describe('routing and guards (production: no session, auth unconfigured)', () => {
  beforeEach(() => {
    mockEnv.env = { ...mockEnv.env, uiPreview: false, supabaseConfigured: false }
    sessionStorage.clear()
  })

  it('redirects the student home to login and explains auth is not configured', async () => {
    const router = await renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByTestId('auth-unconfigured')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  })

  it('fails closed for tutor routes', async () => {
    const router = await renderAt('/tutor/students/st-aysel')
    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(router.state.location.pathname).toBe('/login')
  })

  it('fails closed for lesson routes', async () => {
    const router = await renderAt('/learn/a2-07/lessons/a2-07-03')
    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(router.state.location.pathname).toBe('/login')
  })

  it('validates the login form client-side', async () => {
    mockEnv.env = { ...mockEnv.env, supabaseConfigured: true }
    const user = userEvent.setup()
    await renderAt('/login')
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
  })
})

describe('routing and guards (preview mode)', () => {
  beforeEach(() => {
    mockEnv.env = { ...mockEnv.env, uiPreview: true, supabaseConfigured: false }
    sessionStorage.clear()
  })

  it('renders the student dashboard with the preview banner', async () => {
    await renderAt('/')
    expect(await screen.findByText(/recommended lesson/i)).toBeInTheDocument()
    expect(screen.getByTestId('preview-banner')).toBeInTheDocument()
  })

  it('keeps students out of tutor routes', async () => {
    const router = await renderAt('/tutor')
    await screen.findByText(/recommended lesson/i)
    expect(router.state.location.pathname).toBe('/')
  })

  it('redirects signed-in users away from the login page', async () => {
    const router = await renderAt('/login')
    await screen.findByText(/recommended lesson/i)
    expect(router.state.location.pathname).toBe('/')
  })

  it('lets the preview tutor reach My Students and blocks student-only routes', async () => {
    sessionStorage.setItem('speaklab.preview.role', 'tutor')
    const router = await renderAt('/learn')
    expect(await screen.findByRole('heading', { name: 'My Students' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/tutor')
  })

  it('opens a student card into the profile with sections', async () => {
    sessionStorage.setItem('speaklab.preview.role', 'tutor')
    const user = userEvent.setup()
    const router = await renderAt('/tutor')
    const cards = await screen.findAllByTestId('student-card')
    expect(cards.length).toBeGreaterThan(0)
    await user.click(cards[0]!)
    expect(await screen.findByRole('tab', { name: 'Teacher notes' })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/tutor\/students\//)
  })

  it('shows a not-found screen for unknown routes', async () => {
    await renderAt('/does-not-exist')
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })
})

describe('routing (real auth configured, no session)', () => {
  beforeEach(async () => {
    mockEnv.env = { ...mockEnv.env, uiPreview: false, supabaseConfigured: true, supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'sb_publishable_x' }
    sessionStorage.clear()
    localStorage.clear()
    const { resetSupabaseClientForTests } = await import('@/lib/supabase/client')
    resetSupabaseClientForTests()
  })

  it('the callback page explains that there is nothing to finish when opened without a link', async () => {
    await renderAt('/auth/callback')
    expect(await screen.findByRole('heading', { name: 'Nothing to finish' })).toBeInTheDocument()
  })

  it('onboarding and reset-password routes fail closed without a session', async () => {
    const welcome = await renderAt('/welcome')
    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(welcome.state.location.pathname).toBe('/login')
  })

  it('shows an enabled sign-in button and no "unconfigured" notice', async () => {
    await renderAt('/login')
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeEnabled()
    expect(screen.queryByTestId('auth-unconfigured')).not.toBeInTheDocument()
  })
})
