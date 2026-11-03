import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppEnv } from '@/config/env'
import type { ProfileRow } from '@/lib/supabase/database.types'
// vi.mock calls are hoisted, so these imports already see the fakes below.
import { AuthProvider, useAuth } from './AuthProvider'

/* ------------------------------------------------------------------------------------------ */
/* A tiny in-memory stand-in for the parts of supabase-js the provider touches.                */
/* ------------------------------------------------------------------------------------------ */

const { fake, mockEnv } = vi.hoisted(() => {
  type Listener = (event: string, session: FakeSession | null) => void
  interface FakeSession {
    user: { id: string }
  }
  const fakeState = {
    session: null as FakeSession | null,
    listeners: [] as Listener[],
    profiles: new Map<string, ProfileRow>(),
    profileError: null as { message: string } | null,
    verifyOtp: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
    emit(event: string, session: FakeSession | null) {
      this.session = session
      for (const l of this.listeners) l(event, session)
    },
  }
  const envState: { env: AppEnv } = {
    env: {
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'sb_publishable_test',
      supabaseConfigured: true,
      uiPreview: false,
      basePath: '/speak-lab/',
      isDev: false,
    },
  }
  return { fake: fakeState, mockEnv: envState }
})

function makeProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: 'u1',
    email: 'aysel@example.com',
    full_name: 'Aysel',
    role: 'student',
    status: 'active',
    preferred_language: 'en',
    support_language: 'az',
    preferences: {},
    onboarding_completed_at: '2026-11-01T00:00:00Z',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      onAuthStateChange: (cb: (event: string, session: { user: { id: string } } | null) => void) => {
        fake.listeners.push(cb)
        queueMicrotask(() => cb('INITIAL_SESSION', fake.session))
        return { data: { subscription: { unsubscribe: () => fake.listeners.splice(fake.listeners.indexOf(cb), 1) } } }
      },
      verifyOtp: fake.verifyOtp,
      exchangeCodeForSession: fake.exchangeCodeForSession,
      setSession: fake.setSession,
      signOut: fake.signOut,
    },
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => ({ data: fake.profiles.get(id) ?? null, error: fake.profileError }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/config/env', () => mockEnv)

function Probe() {
  const { state, flow } = useAuth()
  return (
    <div>
      <output data-testid="status">{state.status}</output>
      <output data-testid="detail">
        {state.status === 'authenticated' ? `${state.user.role}:${state.user.status}` : state.status === 'unauthenticated' ? state.reason : state.status === 'error' ? state.message : ''}
      </output>
      <output data-testid="flow">{flow ? `${flow.status}:${flow.type}` : 'none'}</output>
    </div>
  )
}

async function renderProvider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('SupabaseAuthProvider', () => {
  beforeEach(async () => {
    fake.session = null
    fake.listeners = []
    fake.profiles = new Map()
    fake.profileError = null
    fake.verifyOtp.mockReset()
    fake.signOut.mockReset().mockResolvedValue({ error: null })
    const { setPendingAuthRedirectForTests } = await import('./auth-url')
    setPendingAuthRedirectForTests(null)
  })

  it('is unauthenticated with no session', async () => {
    await renderProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    expect(screen.getByTestId('detail')).toHaveTextContent('no-session')
  })

  it('loads the profile for an existing session and exposes role and status', async () => {
    fake.session = { user: { id: 'u1' } }
    fake.profiles.set('u1', makeProfile())
    await renderProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('detail')).toHaveTextContent('student:active')
  })

  it('reflects a disabled profile so guards can block the account', async () => {
    fake.session = { user: { id: 'u1' } }
    fake.profiles.set('u1', makeProfile({ status: 'disabled' }))
    await renderProvider()
    await waitFor(() => expect(screen.getByTestId('detail')).toHaveTextContent('student:disabled'))
  })

  it('fails closed when the profile row is missing', async () => {
    fake.session = { user: { id: 'ghost' } }
    await renderProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
  })

  it('becomes unauthenticated when the session is revoked or expires (SIGNED_OUT)', async () => {
    fake.session = { user: { id: 'u1' } }
    fake.profiles.set('u1', makeProfile())
    await renderProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    fake.emit('SIGNED_OUT', null)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
  })

  it('verifies a captured invitation link with verifyOtp and reports the flow as complete', async () => {
    const { setPendingAuthRedirectForTests } = await import('./auth-url')
    setPendingAuthRedirectForTests({ kind: 'token_hash', tokenHash: 'hash', type: 'invite' })
    fake.profiles.set('u1', makeProfile({ onboarding_completed_at: null }))
    fake.verifyOtp.mockImplementation(async () => {
      const session = { user: { id: 'u1' } }
      fake.emit('SIGNED_IN', session)
      return { data: { session }, error: null }
    })
    await renderProvider()
    await waitFor(() => expect(screen.getByTestId('flow')).toHaveTextContent('complete:invite'))
    expect(fake.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash', type: 'invite' })
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
  })

  it('surfaces an expired link as a flow error without creating a session', async () => {
    const { setPendingAuthRedirectForTests } = await import('./auth-url')
    const { AuthError } = await import('@supabase/supabase-js')
    setPendingAuthRedirectForTests({ kind: 'token_hash', tokenHash: 'old', type: 'recovery' })
    fake.verifyOtp.mockResolvedValue({ data: { session: null }, error: new AuthError('Token has expired or is invalid', 403, 'otp_expired') })
    await renderProvider()
    await waitFor(() => expect(screen.getByTestId('flow')).toHaveTextContent('error:recovery'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
  })
})
