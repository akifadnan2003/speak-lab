import { CloudOff } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { flushPendingLocalWork, listPendingLocalWork, type PendingLocalWork } from '@/lib/local-data'
import { useAuth, useCurrentUser } from './AuthProvider'

/**
 * Sign-out with a warning when work recorded on this device has not reached the server yet
 * (M4 offline vocabulary answers, anything else registered with `registerPendingLocalWork`).
 *
 * Signing out purges every piece of student data on the device (shared phones), so queued
 * answers would be lost silently. The dialog names what is pending and offers an explicit sync
 * first. The sync is the feature's own flush, which only ever sends the signed-in account's
 * queue, so nothing can cross accounts; the purge still happens on every sign-out.
 */
type Phase =
  | { readonly kind: 'closed' }
  | { readonly kind: 'pending'; readonly items: readonly PendingLocalWork[] }
  | { readonly kind: 'syncing'; readonly items: readonly PendingLocalWork[] }
  | { readonly kind: 'failed'; readonly items: readonly PendingLocalWork[]; readonly remaining: number }

function describePending(items: readonly PendingLocalWork[]): string {
  const parts = items.map((i) => `${i.count} ${i.label}`).join(' and ')
  const singular = items.length === 1 && items[0]?.count === 1
  return `${parts} ${singular ? 'is' : 'are'} still waiting on this device. Signing out deletes everything SpeakLab keeps on this device for your account, including those answers.`
}

export function useGuardedSignOut(onSignedOut?: () => void): { requestSignOut: () => void; dialog: ReactNode } {
  const { signOut } = useAuth()
  const user = useCurrentUser()
  const [phase, setPhase] = useState<Phase>({ kind: 'closed' })

  const finish = useCallback(async () => {
    setPhase({ kind: 'closed' })
    await signOut()
    onSignedOut?.()
  }, [signOut, onSignedOut])

  const requestSignOut = useCallback(() => {
    const items = user ? listPendingLocalWork(user.id) : []
    if (items.length === 0) {
      void finish()
      return
    }
    setPhase({ kind: 'pending', items })
  }, [user, finish])

  const syncThenSignOut = useCallback(async () => {
    if (!user || phase.kind === 'closed') return
    const { items } = phase
    setPhase({ kind: 'syncing', items })
    const remaining = await flushPendingLocalWork(user.id)
    if (remaining === 0) {
      await finish()
      return
    }
    setPhase({ kind: 'failed', items, remaining })
  }, [user, phase, finish])

  const open = phase.kind !== 'closed'
  const busy = phase.kind === 'syncing'
  const dialog = (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && setPhase({ kind: 'closed' })}>
      {open ? (
        <DialogContent data-testid="sign-out-guard" data-phase={phase.kind}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudOff className="size-5 shrink-0 text-warning" aria-hidden />
              Some answers have not reached your account
            </DialogTitle>
            <DialogDescription>
              {phase.kind === 'failed'
                ? `${phase.remaining} could not be sent. Check your connection and try again, or sign out and lose them.`
                : describePending(phase.items)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhase({ kind: 'closed' })} disabled={busy} data-testid="sign-out-stay">
              Stay signed in
            </Button>
            <Button variant="danger" onClick={() => void finish()} disabled={busy} data-testid="sign-out-discard">
              Sign out and discard
            </Button>
            <Button onClick={() => void syncThenSignOut()} disabled={busy} data-testid="sign-out-sync">
              {busy ? 'Sending' : phase.kind === 'failed' ? 'Try again' : 'Sync and sign out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )

  return { requestSignOut, dialog }
}
