import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerPendingLocalWork } from '@/lib/local-data'
import { useGuardedSignOut } from './SignOutGuard'

const { auth } = vi.hoisted(() => ({
  auth: { signOut: vi.fn(async () => undefined), user: { id: 'student-a' } as { id: string } | null },
}))
vi.mock('./AuthProvider', () => ({
  useAuth: () => ({ signOut: auth.signOut }),
  useCurrentUser: () => auth.user,
}))

function Harness({ onSignedOut }: { onSignedOut?: () => void }) {
  const { requestSignOut, dialog } = useGuardedSignOut(onSignedOut)
  return (
    <>
      <button type="button" onClick={requestSignOut}>
        Sign out
      </button>
      {dialog}
    </>
  )
}

const unregisters: (() => void)[] = []
function pending(count: number, flush: () => Promise<number>) {
  const seen: string[] = []
  unregisters.push(
    registerPendingLocalWork((studentId) => {
      seen.push(studentId)
      return { label: 'vocabulary answers', count, flush }
    }),
  )
  return seen
}

afterEach(() => {
  for (const u of unregisters.splice(0)) u()
  auth.signOut.mockClear()
  auth.user = { id: 'student-a' }
})

describe('useGuardedSignOut', () => {
  it('signs out straight away when nothing is queued on the device', async () => {
    pending(0, async () => 0)
    const done = vi.fn()
    render(<Harness onSignedOut={done} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1))
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('sign-out-guard')).not.toBeInTheDocument()
  })

  it('warns about queued answers for the signed-in account and keeps the session on "Stay signed in"', async () => {
    const seen = pending(3, async () => 0)
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    const dialog = await screen.findByTestId('sign-out-guard')
    expect(dialog).toHaveAttribute('data-phase', 'pending')
    expect(dialog).toHaveTextContent('3 vocabulary answers are still waiting on this device')
    expect(seen).toEqual(['student-a'])
    await userEvent.click(screen.getByTestId('sign-out-stay'))
    await waitFor(() => expect(screen.queryByTestId('sign-out-guard')).not.toBeInTheDocument())
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('"Sync and sign out" flushes first and signs out only when nothing is left', async () => {
    const flush = vi.fn(async () => 0)
    pending(1, flush)
    const done = vi.fn()
    render(<Harness onSignedOut={done} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByTestId('sign-out-guard')).toHaveTextContent('1 vocabulary answers is still waiting')
    await userEvent.click(screen.getByTestId('sign-out-sync'))
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1))
    expect(flush).toHaveBeenCalledTimes(1)
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    // Order matters: the flush ran before the purge that sign-out triggers.
    expect(flush.mock.invocationCallOrder[0]!).toBeLessThan(auth.signOut.mock.invocationCallOrder[0]!)
  })

  it('reports answers that still could not be sent and lets the learner retry, stay, or discard', async () => {
    const flush = vi.fn(async () => 2)
    pending(2, flush)
    const done = vi.fn()
    render(<Harness onSignedOut={done} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await userEvent.click(await screen.findByTestId('sign-out-sync'))
    await waitFor(() => expect(screen.getByTestId('sign-out-guard')).toHaveAttribute('data-phase', 'failed'))
    expect(screen.getByTestId('sign-out-guard')).toHaveTextContent('2 could not be sent')
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(screen.getByTestId('sign-out-sync')).toHaveTextContent('Try again')
    await userEvent.click(screen.getByTestId('sign-out-discard'))
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1))
    expect(auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('does not consult the queue without a signed-in user', async () => {
    auth.user = null
    const seen = pending(5, async () => 0)
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1))
    expect(seen).toEqual([])
  })
})
