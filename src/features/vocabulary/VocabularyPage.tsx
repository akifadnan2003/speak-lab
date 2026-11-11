import { AlertTriangle, Flame, Layers, Play, Search, Smartphone, Sparkles, Trash2, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader, SectionHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Stat } from '@/components/ui/stat'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { AzHelpProvider, LocalizedTextView, useAzHelp } from '@/features/curriculum/az-help'
import { useProgression } from '@/features/curriculum/CurriculumProvider'
import { CEFR_LEVELS, type CefrLevel } from '@/features/curriculum/schema'
import { cn } from '@/lib/utils'
import { VOCABULARY_MODES } from './modes'
import { LocalImportCard } from './components/LocalImportCard'
import { stageLabel } from './stage-label'
import type { VocabularyStage, VocabularyState } from './ports'
import { QUEUE_REASON_LABEL } from './revision/queue'
import { SUPPORT_LANGUAGE_LABEL, SUPPORT_LANGUAGES, VOCAB_TOPIC_LABEL, VOCAB_TOPICS, type VocabTopic, type VocabularyEntry } from './schema'
import { accuracy } from './srs/scheduler'
import { deviceTimeZone } from './srs/time'
import { computeVocabularyStats } from './stats'
import { useVocabularyBank, useVocabularyMutations, useVocabularyRecords, useVocabularyServices } from './VocabularyProvider'

const STAGE_VARIANT: Record<VocabularyStage, 'neutral' | 'info' | 'primary' | 'success'> = {
  new: 'neutral',
  learning: 'info',
  review: 'primary',
  mastered: 'success',
}

export function VocabularyPage() {
  return (
    <AzHelpProvider>
      <VocabularyDashboard />
    </AzHelpProvider>
  )
}

function VocabularyDashboard() {
  const user = useCurrentUser()
  const bank = useVocabularyBank()
  const records = useVocabularyRecords(user?.id ?? null)
  const progression = useProgression(user?.id ?? null)
  const { storage } = useVocabularyServices()
  const { reset } = useVocabularyMutations(user?.id ?? '')
  // "Now" is fixed when the screen opens so the numbers do not drift between renders.
  const [openedAt] = useState(() => new Date())

  const stats = useMemo(() => {
    if (!user || !bank.data || !records.states || !records.reviews) return null
    const currentChapterIds = progression.states ? [...progression.states.values()].filter((c) => c.status === 'in_progress').map((c) => c.chapter.id) : []
    return computeVocabularyStats(bank.data, records.states, records.reviews, {
      studentId: user.id,
      now: openedAt,
      timeZone: deviceTimeZone(),
      currentChapterIds,
      limit: 12,
    })
  }, [user, bank.data, records.states, records.reviews, progression.states, openedAt])

  if (!stats || !bank.data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-40" />
      </div>
    )
  }

  const stateById = new Map((records.states ?? []).map((s) => [s.entryId, s]))
  const recommendedMode = VOCABULARY_MODES.find((m) => m.id === stats.recommended.modeId)!
  const queue = stats.recommended.queue

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Vocabulary"
        title="Words and phrases"
        description="Spaced repetition keeps the words you know from fading. Recognition and active recall are tracked separately."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <Smartphone className="size-3.5" aria-hidden />
            {storage === 'device' ? 'Progress saved on this device' : 'Progress synced'}
          </span>
        }
      />

      {storage === 'cloud' && <LocalImportCard studentId={user!.id} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="vocab-stats">
        <Stat label="Due now" value={stats.dueNow} hint={stats.overdue > 0 ? `${stats.overdue} overdue` : 'Scheduled reviews'} icon={Layers} tone="primary" />
        <Stat label="Words learned" value={stats.learned} hint={`of ${stats.totalEntries} in the bank`} />
        <Stat label="New" value={stats.byStage.new} hint="Not seen yet" />
        <Stat label="Mastered" value={stats.byStage.mastered} hint="Recalled over 21+ days" icon={Trophy} tone="success" />
        <Stat label="Streak" value={`${stats.streakDays}d`} hint={stats.reviewedToday > 0 ? `${stats.reviewedToday} reviews today` : 'No reviews yet today'} icon={Flame} tone="warning" />
      </div>

      <Card className="border-brand-200/60 bg-gradient-to-br from-brand-50 to-surface dark:border-brand-800/60 dark:from-brand-950/60 dark:to-surface">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">Recommended next session</p>
            {queue.length > 0 ? (
              <>
                <p className="text-sm font-semibold">
                  {recommendedMode.label} · {queue.length} words · about {stats.recommended.estimatedMinutes} min
                </p>
                <p className="text-sm text-fg-muted">{describeQueue(queue.map((q) => q.reason))}</p>
              </>
            ) : (
              <p className="text-sm text-fg-muted">Nothing is due. Open a lesson to meet new words.</p>
            )}
          </div>
          <Button asChild size="lg" disabled={queue.length === 0} data-testid="start-session">
            <Link to={`/vocabulary/practice/${recommendedMode.id}`}>
              <Play aria-hidden /> Start session
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList aria-label="Vocabulary views">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="words">Words ({stats.totalEntries})</TabsTrigger>
          <TabsTrigger value="practice">Practice</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6">
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By level</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-3">
                {stats.byLevel.map((level) => (
                  <div key={level.level} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{level.level}</span>
                      <span className="text-xs text-fg-muted tabular">
                        {level.learned} learned · {level.mastered} mastered · {level.total} total
                      </span>
                    </div>
                    <Progress value={level.total === 0 ? 0 : (level.learned / level.total) * 100} size="sm" />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-2">
                <AlertTriangle className="size-4 text-warning" aria-hidden />
                <CardTitle>Difficult words</CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {stats.difficult.length === 0 ? (
                  <p className="text-sm text-fg-muted">None yet. Words with repeated mistakes will appear here.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {stats.difficult.map((d) => (
                      <li key={d.entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="font-medium">{d.entry.term}</span>
                        <span className="text-xs text-fg-muted tabular">
                          {d.state.lapses} {d.state.lapses === 1 ? 'lapse' : 'lapses'}
                          {d.accuracy !== null ? ` · ${Math.round(d.accuracy * 100)}% correct` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden />
              <CardTitle>Recently learned</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {stats.recentlyLearned.length === 0 ? (
                <p className="text-sm text-fg-muted">Your first session will add words here.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {stats.recentlyLearned.map(({ entry, state }) => (
                    <li key={entry.id}>
                      <Badge variant={STAGE_VARIANT[state.stage]}>{entry.term}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>This device</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-fg-muted">
                Vocabulary progress is stored on this device under your account id until cloud sync is connected. Resetting removes
                every review and schedule for this account on this device only.
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="shrink-0" data-testid="reset-vocab">
                    <Trash2 aria-hidden /> Reset progress
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset vocabulary progress?</DialogTitle>
                    <DialogDescription>
                      This deletes {stats.learned} learned words' schedules and {records.reviews?.length ?? 0} review records on this device.
                      It cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="danger" onClick={() => reset.mutate()} data-testid="confirm-reset">
                        Reset
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="words">
          <WordBrowser entries={bank.data} stateById={stateById} />
        </TabsContent>

        <TabsContent value="practice" className="flex flex-col gap-3">
          <SectionHeader title="Practice modes" description="Move words from recognition to active use." />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {VOCABULARY_MODES.map((mode) => (
              <li key={mode.id}>
                <Card className={cn('h-full', !mode.available && 'opacity-80')}>
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{mode.label}</p>
                      <Badge variant={mode.skill === 'recall' ? 'primary' : mode.skill === 'spoken' ? 'info' : 'neutral'}>
                        {mode.skill === 'recall' ? 'Active recall' : mode.skill === 'spoken' ? 'Speaking' : 'Recognition'}
                      </Badge>
                    </div>
                    <p className="flex-1 text-sm text-fg-muted">{mode.description}</p>
                    {mode.available ? (
                      <Button asChild variant="outline" size="sm" className="w-fit">
                        <Link to={`/vocabulary/practice/${mode.id}`}>Start</Link>
                      </Button>
                    ) : (
                      <p className="text-xs text-fg-subtle">{mode.unavailableReason}</p>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function describeQueue(reasons: readonly (keyof typeof QUEUE_REASON_LABEL)[]): string {
  const counts = new Map<string, number>()
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1)
  return [...counts.entries()].map(([reason, n]) => `${n} ${QUEUE_REASON_LABEL[reason as keyof typeof QUEUE_REASON_LABEL].toLowerCase()}`).join(' · ')
}

function WordBrowser({ entries, stateById }: { entries: readonly VocabularyEntry[]; stateById: ReadonlyMap<string, VocabularyState> }) {
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState<VocabTopic | 'all'>('all')
  const [level, setLevel] = useState<CefrLevel | 'all'>('all')
  const [stage, setStage] = useState<VocabularyStage | 'all'>('all')
  const az = useAzHelp()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((e) => {
      if (topic !== 'all' && !e.topics.includes(topic)) return false
      if (level !== 'all' && e.level !== level) return false
      if (stage !== 'all' && (stateById.get(e.id)?.stage ?? 'new') !== stage) return false
      if (!q) return true
      return (
        e.term.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q) ||
        Object.values(e.translations).some((t) => t?.toLowerCase().includes(q))
      )
    })
  }, [entries, query, topic, level, stage, stateById])

  const selectClass =
    'h-11 rounded-lg border border-line-strong bg-surface px-3 text-base text-fg shadow-xs sm:h-10 sm:text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input
            type="search"
            placeholder="Search words, meanings or translations"
            aria-label="Search vocabulary"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
          Topic
          <select className={selectClass} value={topic} onChange={(e) => setTopic(e.target.value as VocabTopic | 'all')}>
            <option value="all">All topics</option>
            {VOCAB_TOPICS.map((t) => (
              <option key={t} value={t}>
                {VOCAB_TOPIC_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
          Level
          <select className={selectClass} value={level} onChange={(e) => setLevel(e.target.value as CefrLevel | 'all')}>
            <option value="all">All levels</option>
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
          Status
          <select className={selectClass} value={stage} onChange={(e) => setStage(e.target.value as VocabularyStage | 'all')}>
            <option value="all">All</option>
            {(['new', 'learning', 'review', 'mastered'] as const).map((s) => (
              <option key={s} value={s}>
                {stageLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Switch id="vocab-az" checked={az.enabled} onCheckedChange={az.setEnabled} />
          <Label htmlFor="vocab-az">{SUPPORT_LANGUAGES.map((l) => SUPPORT_LANGUAGE_LABEL[l]).join(' / ')} translations</Label>
        </div>
      </div>

      <p className="text-xs text-fg-muted tabular" aria-live="polite">
        {filtered.length} of {entries.length} words
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matches" description="Try a different word, topic or filter." compact />
      ) : (
        <Card>
          <CardContent className="flex flex-col divide-y divide-line p-0">
            {filtered.map((entry) => (
              <WordRow key={entry.id} entry={entry} state={stateById.get(entry.id)} showTranslations={az.enabled} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function WordRow({ entry, state, showTranslations }: { entry: VocabularyEntry; state?: VocabularyState; showTranslations: boolean }) {
  const stage = state?.stage ?? 'new'
  const recognition = state ? accuracy(state.recognition) : null
  const recall = state ? accuracy(state.recall) : null
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5" data-testid="word-row">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold">{entry.term}</p>
          <span className="text-xs text-fg-subtle italic">{entry.partOfSpeech}</span>
          <Badge variant="outline">{entry.level}</Badge>
          <Badge variant={STAGE_VARIANT[stage]}>{stageLabel(stage)}</Badge>
          {entry.pronunciation?.respelling ? <span className="text-xs text-fg-subtle">/{entry.pronunciation.respelling}/</span> : null}
        </div>
        <p className="text-sm">{entry.definition}</p>
        <p className="text-sm text-fg-muted italic">{entry.examples[0]}</p>
        {showTranslations ? (
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-fg-muted">
            {SUPPORT_LANGUAGES.filter((l) => entry.translations[l]).map((l) => (
              <p key={l}>
                <span className="font-medium text-fg">{SUPPORT_LANGUAGE_LABEL[l]}:</span>{' '}
                <span lang={l}>{entry.translations[l]}</span>
              </p>
            ))}
            {entry.grammarNote ? <LocalizedTextView text={entry.grammarNote} /> : null}
          </div>
        ) : null}
        <p className="mt-0.5 text-xs text-fg-subtle">{entry.topics.map((t) => VOCAB_TOPIC_LABEL[t]).join(' · ')}</p>
      </div>
      <dl className="flex shrink-0 gap-4 text-xs sm:flex-col sm:gap-1 sm:text-right">
        <div>
          <dt className="text-fg-subtle">Recognition</dt>
          <dd className="font-medium tabular">{recognition === null ? '—' : `${Math.round(recognition * 100)}%`}</dd>
        </div>
        <div>
          <dt className="text-fg-subtle">Recall</dt>
          <dd className="font-medium tabular">{recall === null ? '—' : `${Math.round(recall * 100)}%`}</dd>
        </div>
        {state?.dueAt ? (
          <div>
            <dt className="text-fg-subtle">Next</dt>
            <dd className="font-medium tabular">{new Date(state.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}
