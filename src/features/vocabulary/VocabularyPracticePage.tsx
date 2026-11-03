import { ArrowLeft, Layers } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { AzHelpProvider } from '@/features/curriculum/az-help'
import { useProgression } from '@/features/curriculum/CurriculumProvider'
import { VocabularySession } from './components/VocabularySession'
import { findMode } from './modes'
import { buildRevisionQueue } from './revision/queue'
import { deviceTimeZone } from './srs/time'
import { useVocabularyBank, useVocabularyMutations, useVocabularyRecords } from './VocabularyProvider'

export const SESSION_LIMIT = 12

export function VocabularyPracticePage() {
  const { modeId = '' } = useParams()
  const user = useCurrentUser()
  const mode = findMode(modeId)
  const bank = useVocabularyBank()
  const records = useVocabularyRecords(user?.id ?? null)
  const progression = useProgression(user?.id ?? null)
  const { saveReview } = useVocabularyMutations(user?.id ?? '')
  // A round starts a fresh session; the session component snapshots the queue
  // it receives, so later record updates never reorder items mid-session.
  const [round, setRound] = useState(() => ({ n: 0, startedAt: new Date() }))
  const queue = useMemo(() => {
    if (!user || !bank.data || !records.states) return null
    const currentChapterIds = progression.states ? [...progression.states.values()].filter((c) => c.status === 'in_progress').map((c) => c.chapter.id) : []
    const limit = mode && mode.groupSize > 1 ? SESSION_LIMIT - (SESSION_LIMIT % mode.groupSize) : SESSION_LIMIT
    return buildRevisionQueue(bank.data, records.states, {
      studentId: user.id,
      now: round.startedAt,
      timeZone: deviceTimeZone(),
      currentChapterIds,
      limit,
    })
  }, [user, bank.data, records.states, progression.states, mode, round.startedAt])

  const onReview = useCallback(
    (state: Parameters<typeof saveReview.mutate>[0]['state'], review: Parameters<typeof saveReview.mutate>[0]['review']) =>
      saveReview.mutate({ state, review }),
    [saveReview],
  )

  if (!mode) {
    return (
      <EmptyState
        title="Practice mode not found"
        action={
          <Button asChild variant="outline">
            <Link to="/vocabulary">Back to vocabulary</Link>
          </Button>
        }
      />
    )
  }

  if (!mode.available) {
    return (
      <EmptyState
        icon={Layers}
        title={`${mode.label} is not available yet`}
        description={mode.unavailableReason}
        action={
          <Button asChild variant="outline">
            <Link to="/vocabulary">Back to vocabulary</Link>
          </Button>
        }
      />
    )
  }

  if (!user || queue === null) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <AzHelpProvider>
      <div className="flex flex-col gap-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link to="/vocabulary">
            <ArrowLeft aria-hidden /> Vocabulary
          </Link>
        </Button>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">Practice</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{mode.label}</h1>
          <p className="text-sm text-fg-muted">{mode.description}</p>
        </div>
        <Card>
          <CardContent>
            {queue.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="Nothing to practise right now"
                description="Every word is scheduled for later. Come back when reviews are due, or open a lesson to meet new words."
                compact
              />
            ) : (
              <VocabularySession
                key={round.n}
                mode={mode}
                queue={queue}
                bank={bank.data ?? []}
                studentId={user.id}
                onReview={onReview}
                onRestart={() => setRound((r) => ({ n: r.n + 1, startedAt: new Date() }))}
                summaryActions={
                  <Button asChild>
                    <Link to="/vocabulary">Back to vocabulary</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AzHelpProvider>
  )
}
