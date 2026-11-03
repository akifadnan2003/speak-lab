import { Layers, Play, Search, Volume2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader, SectionHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { Stat } from '@/components/ui/stat'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEMO_VOCAB, DEMO_VOCAB_TOPICS, VOCAB_PRACTICE_MODES, type VocabStage } from '@/demo/vocabulary'
import { DEMO_STUDENT_SNAPSHOT } from '@/demo/student-home'

const STAGE_BADGE: Record<VocabStage, { label: string; variant: 'neutral' | 'info' | 'primary' | 'success' }> = {
  new: { label: 'New', variant: 'neutral' },
  learning: { label: 'Learning', variant: 'info' },
  reviewing: { label: 'Reviewing', variant: 'primary' },
  mastered: { label: 'Mastered', variant: 'success' },
}

export function VocabularyPage() {
  const [query, setQuery] = useState('')
  const due = DEMO_VOCAB.filter((item) => item.dueAt && new Date(item.dueAt) <= new Date('2026-11-03T12:00:00Z'))
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return DEMO_VOCAB
    return DEMO_VOCAB.filter(
      (item) =>
        item.term.toLowerCase().includes(q) ||
        item.definition.toLowerCase().includes(q) ||
        item.azTranslation.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Vocabulary"
        title="Words and phrases"
        description="Spaced repetition keeps the words you know from fading. Recognition and recall are tracked separately."
        actions={<DemoNotice>Spaced repetition connects in M4.</DemoNotice>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Due today" value={DEMO_STUDENT_SNAPSHOT.vocabularyDue} icon={Layers} tone="primary" />
        <Stat label="Words learned" value={DEMO_STUDENT_SNAPSHOT.wordsLearned} hint="Across all topics" />
        <Stat label="Retention" value="86%" hint="Reviews answered correctly" tone="success" />
        <Stat label="Mastered" value={DEMO_VOCAB_TOPICS.reduce((s, t) => s + t.mastered, 0)} hint="Recall 90%+" />
      </div>

      <Card className="border-brand-200/60 bg-gradient-to-br from-brand-50 to-surface dark:border-brand-800/60 dark:from-brand-950/60 dark:to-surface">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Review queue</p>
            <p className="text-sm text-fg-muted tabular">{DEMO_STUDENT_SNAPSHOT.vocabularyDue} words are due. About 6 minutes.</p>
          </div>
          <Button size="lg" disabled>
            <Play aria-hidden /> Start review
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="due">
        <TabsList aria-label="Vocabulary views">
          <TabsTrigger value="due">Due ({due.length})</TabsTrigger>
          <TabsTrigger value="all">All words</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="practice">Practice</TabsTrigger>
        </TabsList>

        <TabsContent value="due">
          <WordList items={due} />
        </TabsContent>

        <TabsContent value="all" className="flex flex-col gap-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <Input
              type="search"
              placeholder="Search words, meanings or topics"
              aria-label="Search vocabulary"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {filtered.length ? (
            <WordList items={filtered} />
          ) : (
            <EmptyState icon={Search} title="No matches" description="Try a different word or topic." compact />
          )}
        </TabsContent>

        <TabsContent value="topics">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_VOCAB_TOPICS.map((topic) => {
              const pct = Math.round((topic.mastered / topic.total) * 100)
              return (
                <li key={topic.topic}>
                  <Card>
                    <CardContent className="flex flex-col gap-2 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{topic.topic}</p>
                        <span className="text-xs text-fg-muted tabular">
                          {topic.mastered}/{topic.total}
                        </span>
                      </div>
                      <Progress value={pct} size="sm" />
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        </TabsContent>

        <TabsContent value="practice">
          <SectionHeader title="Practice modes" description="Move words from recognition to active use." className="mb-3" />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {VOCAB_PRACTICE_MODES.map((mode) => (
              <li key={mode.id}>
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <p className="text-sm font-semibold">{mode.title}</p>
                    <p className="flex-1 text-sm text-fg-muted">{mode.description}</p>
                    <Button variant="outline" size="sm" className="w-fit" disabled>
                      Coming in M4
                    </Button>
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

function WordList({ items }: { items: typeof DEMO_VOCAB }) {
  return (
    <Card>
      <CardHeader className="sr-only">Word list</CardHeader>
      <CardContent className="flex flex-col divide-y divide-line p-0">
        {items.map((item) => {
          const stage = STAGE_BADGE[item.stage]
          return (
            <div key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold">{item.term}</p>
                  <span className="text-xs text-fg-subtle italic">{item.partOfSpeech}</span>
                  <Badge variant={stage.variant}>{stage.label}</Badge>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={`Play pronunciation of ${item.term}`}
                  >
                    <Volume2 className="size-4" aria-hidden />
                  </button>
                </div>
                <p className="text-sm">{item.definition}</p>
                <p className="text-sm text-fg-muted italic">{item.example}</p>
                <p className="mt-0.5 text-xs text-fg-muted">
                  <span className="font-medium text-fg">AZ:</span> {item.azTranslation} · {item.topic}
                </p>
              </div>
              <dl className="flex shrink-0 gap-4 text-xs sm:flex-col sm:gap-1 sm:text-right">
                <div>
                  <dt className="text-fg-subtle">Recognition</dt>
                  <dd className="font-medium tabular">{item.recognition}%</dd>
                </div>
                <div>
                  <dt className="text-fg-subtle">Recall</dt>
                  <dd className="font-medium tabular">{item.recall}%</dd>
                </div>
              </dl>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
