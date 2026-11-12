import { CloudOff, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { useVocabularyPendingCount, useVocabularyServices } from '../VocabularyProvider'

/**
 * Tells the learner when answers given on this device have not reached their account yet
 * (offline, outage, expired session) and lets them retry. Renders nothing while everything is
 * synced or in device mode, so the usual "Saved to your account" label stays truthful.
 */
export function PendingSyncBadge({ className }: { className?: string }) {
  const user = useCurrentUser()
  const { sync } = useVocabularyServices()
  const pending = useVocabularyPendingCount(user?.id ?? null)
  const [busy, setBusy] = useState(false)
  if (!sync || pending === 0) return null

  const retry = async () => {
    setBusy(true)
    try {
      await sync.flush()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="status"
      data-testid="vocab-pending-sync"
      data-count={pending}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-soft-fg',
        className,
      )}
    >
      <CloudOff className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <strong className="font-semibold">
          {pending} {pending === 1 ? 'answer has' : 'answers have'} not reached your account yet.
        </strong>{' '}
        They stay on this device and are sent automatically when you are back online. Signing out deletes them.
      </span>
      <button
        type="button"
        onClick={() => void retry()}
        disabled={busy}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
        data-testid="vocab-pending-retry"
      >
        <RefreshCw className={cn('size-3.5', busy && 'animate-spin')} aria-hidden />
        {busy ? 'Sending' : 'Try now'}
      </button>
    </div>
  )
}
