import { Award, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { cn, formatRelative } from '@/lib/utils'
import type { Achievement } from './analytics'

/** Evidence-based milestones. Earned ones first; the rest show how far along they are. */
export function AchievementsCard({ achievements, compact = false }: { achievements: readonly Achievement[]; compact?: boolean }) {
  const shown = compact ? achievements.filter((a) => a.earnedAt).slice(0, 3) : achievements
  const earnedCount = achievements.filter((a) => a.earnedAt).length
  return (
    <Card data-testid="achievements-card" data-earned={earnedCount}>
      <CardHeader>
        <SectionHeader
          title="Achievements"
          description={compact ? undefined : `${earnedCount} of ${achievements.length} earned. Each one is tied to a stored record, never to opening a page.`}
          as="h2"
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {shown.length === 0 ? (
          <p className="text-sm text-fg-muted">Finish your first lesson or vocabulary review to earn the first one.</p>
        ) : (
          shown.map((a) => {
            const earned = a.earnedAt !== undefined
            return (
              <div key={a.id} className={cn('flex items-start gap-3', !earned && 'opacity-80')} data-testid="achievement" data-id={a.id} data-earned={earned}>
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', earned ? 'bg-warning-soft text-warning-soft-fg' : 'bg-surface-2 text-fg-subtle')}>
                  {earned ? <Award className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-fg-muted">
                    {a.description}
                    {earned ? ` · ${formatRelative(a.earnedAt!)}` : ''}
                  </p>
                  {!earned && a.progress ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress value={(a.progress.current / a.progress.target) * 100} size="sm" className="max-w-40" aria-label={`${a.title} progress`} />
                      <span className="text-xs text-fg-subtle tabular">
                        {a.progress.current}/{a.progress.target}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
