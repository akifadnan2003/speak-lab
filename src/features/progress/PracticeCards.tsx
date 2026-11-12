import { ArrowRight, ClipboardCheck, Layers, Play, RotateCcw, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import type { NextStep, PracticeInsights } from './analytics'
import { WEAK_ACCURACY, WEAK_MIN_EXERCISES } from './analytics/weak-topics'

const STEP_ICON: Record<NextStep['kind'], LucideIcon> = {
  start: Play,
  continue: Play,
  chapter_check: ClipboardCheck,
  vocabulary_due: Layers,
  weak_topic: RotateCcw,
}

/** Topics with enough evidence of difficulty, each linked to something the learner can open now. */
export function WeakTopicsCard({ insights, compact = false }: { insights: PracticeInsights; compact?: boolean }) {
  const { weakTopics, insufficient } = insights
  return (
    <Card data-testid="weak-topics-card">
      <CardHeader>
        <SectionHeader
          title="Needs more practice"
          description={compact ? undefined : `A lesson appears here after at least ${WEAK_MIN_EXERCISES} exercises with under ${WEAK_ACCURACY}% right on the first try; chapter checks below the pass mark and words forgotten repeatedly also count.`}
          as="h2"
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {weakTopics.length === 0 ? (
          <p className="text-sm text-fg-muted" data-testid="weak-topics-empty">
            {insufficient > 0 ? `Not enough practice data yet (${insufficient} ${insufficient === 1 ? 'lesson' : 'lessons'} started). Keep going and this updates itself.` : 'Nothing stands out yet. Topics appear here once practice shows a pattern.'}
          </p>
        ) : (
          weakTopics.map((topic) => (
            <div key={topic.id} className="flex flex-col gap-1.5" data-testid="weak-topic" data-kind={topic.kind}>
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium">
                  {topic.href ? (
                    <Link to={topic.href} className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      {topic.title}
                    </Link>
                  ) : (
                    topic.title
                  )}
                </span>
                {topic.accuracy !== null ? <span className="shrink-0 text-xs font-semibold tabular">{topic.accuracy}%</span> : null}
              </div>
              {topic.accuracy !== null ? <Progress value={topic.accuracy} size="sm" indicatorClassName="bg-warning" aria-label={`${topic.title} accuracy`} /> : null}
              <p className="text-xs text-fg-muted">{topic.detail}</p>
            </div>
          ))
        )}
        {!compact && insufficient > 0 && weakTopics.length > 0 ? (
          <p className="text-xs text-fg-subtle">
            {insufficient} other {insufficient === 1 ? 'lesson has' : 'lessons have'} not enough practice data yet.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** What to do next, derived from the current chapter, due words and weak topics. */
export function NextStepsCard({ steps }: { steps: readonly NextStep[] }) {
  return (
    <Card data-testid="next-steps-card">
      <CardHeader>
        <SectionHeader title="What to study next" as="h2" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        {steps.length === 0 ? (
          <p className="text-sm text-fg-muted">Everything available is done. New chapters are on the way.</p>
        ) : (
          steps.map((step) => {
            const Icon = STEP_ICON[step.kind]
            return (
              <Link
                key={step.id}
                to={step.href}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-line p-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                data-testid="next-step"
                data-kind={step.kind}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{step.title}</span>
                  <span className="block text-xs text-fg-muted">{step.detail}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              </Link>
            )
          })
        )}
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-fg-subtle">
          <Sparkles className="size-3.5" aria-hidden /> Based on your records, updated as you learn.
        </p>
      </CardContent>
    </Card>
  )
}
