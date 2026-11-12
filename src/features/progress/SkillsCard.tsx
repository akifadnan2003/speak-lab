import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { LESSON_KIND_LABEL } from '@/features/curriculum/schema'
import { cn } from '@/lib/utils'
import type { SkillSummary } from './analytics'

const SKILL_COLOR: Record<SkillSummary['skill'], string> = {
  grammar: 'bg-skill-grammar',
  vocabulary: 'bg-skill-vocabulary',
  speaking: 'bg-skill-speaking',
  listening: 'bg-skill-listening',
  reading: 'bg-skill-reading',
  writing: 'bg-skill-writing',
  pronunciation: 'bg-skill-speaking',
}

function evidenceLabel(s: SkillSummary): string {
  switch (s.evidence.kind) {
    case 'measured':
      return `${s.evidence.accuracy}% first-try accuracy`
    case 'insufficient':
      return 'Not assessed yet'
    case 'self_checked':
      return 'Self-checked only'
    case 'no_content':
      return 'No lessons yet'
  }
}

function evidenceDetail(s: SkillSummary): string {
  const part = `${s.lessonsCompleted} ${s.lessonsCompleted === 1 ? 'lesson' : 'lessons'} completed · ${s.exercisesTried} ${s.exercisesTried === 1 ? 'exercise' : 'exercises'} tried`
  switch (s.evidence.kind) {
    case 'measured':
      return s.skill === 'vocabulary'
        ? `${s.evidence.sample} reviews · ${s.evidence.mastered ?? 0}% of learned words mastered`
        : `${part} · based on ${s.evidence.sample} graded exercises`
    case 'insufficient':
      return s.skill === 'vocabulary'
        ? `${s.evidence.sample} of ${s.evidence.needed} reviews needed before a score is shown`
        : `${part} · ${s.evidence.sample} of ${s.evidence.needed} graded exercises needed before a score is shown`
    case 'self_checked':
      return `${part} · scored by you, not graded, until the AI coach (M7)`
    case 'no_content':
      return 'Listening lessons are not written yet'
  }
}

/**
 * Six skills, each with participation (lessons, exercises) and accuracy or mastery only where
 * graded evidence exists. "Not assessed yet" is a deliberate state, never 0%.
 */
export function SkillsCard({ skills, compact = false }: { skills: readonly SkillSummary[]; compact?: boolean }) {
  return (
    <Card data-testid="skills-card">
      <CardHeader>
        <SectionHeader
          title="English skills"
          description={compact ? undefined : 'Accuracy is the share of graded exercises answered correctly on the first try. Speaking and writing are self-checked until the AI coach arrives.'}
          as="h2"
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {skills.map((s) => {
          const measured = s.evidence.kind === 'measured'
          return (
            <div key={s.skill} className="flex flex-col gap-1.5" data-testid="skill-row" data-skill={s.skill} data-evidence={s.evidence.kind}>
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span className={cn('size-2.5 rounded-sm', SKILL_COLOR[s.skill])} aria-hidden />
                  {LESSON_KIND_LABEL[s.skill]}
                </span>
                <span className={cn('shrink-0 text-right text-xs tabular', measured ? 'font-semibold text-fg' : 'text-fg-muted')}>{evidenceLabel(s)}</span>
              </div>
              {measured ? (
                <Progress value={s.evidence.kind === 'measured' ? s.evidence.accuracy : 0} size="sm" indicatorClassName={SKILL_COLOR[s.skill]} aria-label={`${LESSON_KIND_LABEL[s.skill]} accuracy`} />
              ) : (
                <div className="h-1.5 w-full rounded-full border border-dashed border-line" aria-hidden />
              )}
              {!compact ? <p className="text-xs text-fg-muted">{evidenceDetail(s)}</p> : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
