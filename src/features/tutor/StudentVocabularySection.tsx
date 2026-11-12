import { ChevronDown, ChevronUp, Layers, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Stat } from '@/components/ui/stat'
import type { VocabularyReviewRecord, VocabularyState } from '@/features/vocabulary/ports'
import type { VocabularyEntry } from '@/features/vocabulary/schema'
import { deviceTimeZone } from '@/features/vocabulary/srs/time'
import { stageLabel } from '@/features/vocabulary/stage-label'
import { computeVocabularyStats } from '@/features/vocabulary/stats'
import { useVocabularyBank, useVocabularyServices, vocabularyKeys } from '@/features/vocabulary/VocabularyProvider'
import { useQuery } from '@tanstack/react-query'
import { cn, formatRelative } from '@/lib/utils'

/**
 * Read-only vocabulary analytics for a linked student, from the server-owned SRS rows (M4).
 * Uses the same `computeVocabularyStats` as the student's dashboard, so both see the same
 * numbers. Nothing here writes to vocabulary tables.
 */
type Filter = 'all' | 'learned' | 'due' | 'difficult' | 'mastered' | 'new'

const FILTER_LABEL: Record<Filter, string> = { all: 'All', learned: 'Learned', due: 'Due', difficult: 'Difficult', mastered: 'Mastered', new: 'Not seen' }

function accuracy(correct: number, incorrect: number): number | null {
  const total = correct + incorrect
  return total === 0 ? null : Math.round((correct / total) * 100)
}

export function StudentVocabularySection({ studentId }: { studentId: string }) {
  const bank = useVocabularyBank()
  const { records } = useVocabularyServices()
  const states = useQuery({ queryKey: vocabularyKeys.states(studentId), queryFn: () => records.listStates(studentId), enabled: studentId.length > 0 })
  const reviews = useQuery({ queryKey: vocabularyKeys.reviews(studentId), queryFn: () => records.listReviews(studentId), enabled: studentId.length > 0 })
  const [now] = useState(() => new Date())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('learned')
  const [open, setOpen] = useState<string | null>(null)

  const stats = useMemo(() => {
    if (!bank.data || !states.data || !reviews.data) return null
    return computeVocabularyStats(bank.data, states.data, reviews.data, { studentId, now, timeZone: deviceTimeZone(), limit: 12 })
  }, [bank.data, states.data, reviews.data, studentId, now])

  const error = bank.error ?? states.error ?? reviews.error
  if (error) return <EmptyState compact title="Vocabulary could not be loaded" description={error instanceof Error ? error.message : 'Try again.'} />
  if (!stats || !bank.data || !states.data || !reviews.data) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const stateById = new Map(states.data.map((s) => [s.entryId, s]))
  const reviewsByEntry = new Map<string, VocabularyReviewRecord[]>()
  for (const r of reviews.data) {
    const list = reviewsByEntry.get(r.entryId) ?? []
    list.push(r)
    reviewsByEntry.set(r.entryId, list)
  }
  const difficultIds = new Set(stats.difficult.map((d) => d.entry.id))
  const lapsed = states.data.filter((s) => s.lapses >= 2).length
  const recognition = states.data.reduce((acc, s) => ({ c: acc.c + s.recognition.correct, i: acc.i + s.recognition.incorrect }), { c: 0, i: 0 })
  const recall = states.data.reduce((acc, s) => ({ c: acc.c + s.recall.correct, i: acc.i + s.recall.incorrect }), { c: 0, i: 0 })
  const recent = [...reviews.data].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)).slice(0, 8)
  const entryById = new Map(bank.data.map((e) => [e.id, e]))

  const q = query.trim().toLowerCase()
  const rows = bank.data
    .filter((entry) => {
      const state = stateById.get(entry.id)
      switch (filter) {
        case 'learned':
          return state !== undefined && state.stage !== 'new'
        case 'due':
          return state !== undefined && state.stage !== 'new' && state.dueAt !== null && new Date(state.dueAt).getTime() <= now.getTime()
        case 'difficult':
          return difficultIds.has(entry.id)
        case 'mastered':
          return state?.stage === 'mastered'
        case 'new':
          return state === undefined || state.stage === 'new'
        default:
          return true
      }
    })
    .filter((entry) => q.length === 0 || entry.term.toLowerCase().includes(q) || entry.definition.toLowerCase().includes(q) || (entry.translations.az ?? '').toLowerCase().includes(q))
    .sort((a, b) => {
      const sa = stateById.get(a.id)
      const sb = stateById.get(b.id)
      const la = sa?.lastReviewedAt ?? ''
      const lb = sb?.lastReviewedAt ?? ''
      return lb.localeCompare(la) || a.term.localeCompare(b.term)
    })
    .slice(0, 200)

  return (
    <div className="flex flex-col gap-6" data-testid="student-vocabulary">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Words learned" value={stats.learned} hint={`of ${stats.totalEntries} in the bank`} icon={Layers} tone="primary" />
        <Stat label="Mastered" value={stats.byStage.mastered} hint="Recalled over 21+ days" tone="success" />
        <Stat label="Due now" value={stats.dueNow} hint={stats.overdue > 0 ? `${stats.overdue} overdue` : 'Scheduled reviews'} tone={stats.overdue > 0 ? 'warning' : 'default'} />
        <Stat label="Difficult" value={stats.difficult.length} hint={lapsed > 0 ? `${lapsed} ${lapsed === 1 ? 'word' : 'words'} forgotten twice or more` : 'No repeated lapses'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recognition vs recall</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0 text-sm">
            <SkillLine label="Recognition (choose the meaning, matching, flashcards)" correct={recognition.c} incorrect={recognition.i} />
            <SkillLine label="Active recall (type the word)" correct={recall.c} incorrect={recall.i} />
            <p className="text-xs text-fg-muted">Accuracy over every answer recorded on the server. Mastery requires three correct recalls at 21+ days (M4 scheduler).</p>
            <p className="text-xs text-fg-muted tabular" data-testid="vocab-streak">
              Streak {stats.streakDays} {stats.streakDays === 1 ? 'day' : 'days'} · {stats.reviewedToday} reviews today · {reviews.data.length} reviews in total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent practice</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recent.length === 0 ? (
              <p className="text-sm text-fg-muted">No vocabulary reviews yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line text-sm">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-1.5 first:pt-0 last:pb-0">
                    <span className={cn('size-2 shrink-0 rounded-full', r.correct ? 'bg-success' : 'bg-danger')} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      {entryById.get(r.entryId)?.term ?? r.entryId} <span className="text-fg-muted">· {r.skill === 'recall' ? 'recall' : 'recognition'}</span>
                    </span>
                    <time dateTime={r.reviewedAt} className="shrink-0 text-xs text-fg-subtle">
                      {formatRelative(r.reviewedAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-col gap-3">
          <CardTitle>Words</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search words, meanings or Azerbaijani" className="pl-9" aria-label="Search words" data-testid="vocab-search" />
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter words">
              {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={cn('min-h-9 rounded-full border px-3 text-xs font-medium', filter === key ? 'border-primary bg-primary-soft text-primary-soft-fg' : 'border-line text-fg-muted hover:bg-surface-2')}
                >
                  {FILTER_LABEL[key]}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {rows.length === 0 ? (
            <p className="text-sm text-fg-muted" data-testid="vocab-words-empty">
              No words match.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line" data-testid="vocab-word-list">
              {rows.map((entry) => (
                <WordRow key={entry.id} entry={entry} state={stateById.get(entry.id)} reviews={reviewsByEntry.get(entry.id) ?? []} open={open === entry.id} onToggle={() => setOpen(open === entry.id ? null : entry.id)} difficult={difficultIds.has(entry.id)} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SkillLine({ label, correct, incorrect }: { label: string; correct: number; incorrect: number }) {
  const acc = accuracy(correct, incorrect)
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1">{label}</span>
      <span className="shrink-0 text-xs tabular">{acc === null ? 'Not measured yet' : `${acc}% of ${correct + incorrect}`}</span>
    </div>
  )
}

function WordRow({ entry, state, reviews, open, onToggle, difficult }: { entry: VocabularyEntry; state: VocabularyState | undefined; reviews: readonly VocabularyReviewRecord[]; open: boolean; onToggle: () => void; difficult: boolean }) {
  const stage = state?.stage ?? 'new'
  const history = [...reviews].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)).slice(0, 10)
  return (
    <li data-testid="vocab-word-row" data-entry={entry.id} data-stage={stage}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-11 w-full items-center gap-3 py-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {entry.term} <span className="text-xs font-normal text-fg-muted">{entry.partOfSpeech}</span>
          </span>
          <span className="block truncate text-xs text-fg-muted">{entry.definition}</span>
        </span>
        <Badge variant={stage === 'mastered' ? 'success' : stage === 'new' ? 'neutral' : 'info'}>{stageLabel(stage)}</Badge>
        {difficult ? <Badge variant="warning">Difficult</Badge> : null}
        {open ? <ChevronUp className="size-4 text-fg-subtle" aria-hidden /> : <ChevronDown className="size-4 text-fg-subtle" aria-hidden />}
      </button>
      {open ? (
        <div className="mb-3 rounded-lg border border-line p-3 text-sm" data-testid="vocab-word-detail">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {entry.translations.az ? (
              <>
                <dt className="text-fg-muted">Azerbaijani</dt>
                <dd>{entry.translations.az}</dd>
              </>
            ) : null}
            <dt className="text-fg-muted">Level · chapters</dt>
            <dd>
              {entry.level} · {entry.chapterIds.length > 0 ? entry.chapterIds.join(', ') : 'none'}
            </dd>
            {state ? (
              <>
                <dt className="text-fg-muted">Schedule</dt>
                <dd className="tabular">
                  interval {state.intervalDays}d · ease {state.ease.toFixed(2)} · {state.dueAt ? `due ${formatRelative(state.dueAt)}` : 'not scheduled'}
                </dd>
                <dt className="text-fg-muted">Accuracy</dt>
                <dd className="tabular">
                  recognition {accuracy(state.recognition.correct, state.recognition.incorrect) ?? '–'}% · recall {accuracy(state.recall.correct, state.recall.incorrect) ?? '–'}% · lapses {state.lapses}
                  {state.recallStreak > 0 ? ` · recall streak ${state.recallStreak}` : ''}
                </dd>
                <dt className="text-fg-muted">First learned</dt>
                <dd>{state.firstLearnedAt ? formatRelative(state.firstLearnedAt) : 'not yet'}</dd>
              </>
            ) : (
              <>
                <dt className="text-fg-muted">Progress</dt>
                <dd>Not seen yet</dd>
              </>
            )}
          </dl>
          {history.length > 0 ? (
            <ol className="mt-2 flex flex-wrap gap-1" aria-label="Last reviews, newest first">
              {history.map((r) => (
                <li key={r.id} title={`${r.correct ? 'Correct' : 'Incorrect'} · ${r.skill} · ${new Date(r.reviewedAt).toLocaleString()}`} className={cn('size-3 rounded-sm', r.correct ? 'bg-success' : 'bg-danger')} />
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
