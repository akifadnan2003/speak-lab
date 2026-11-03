import { ChevronRight, Clock, Mic } from 'lucide-react'
import { Link } from 'react-router'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PageHeader, SectionHeader } from '@/components/ui/page-header'
import { DEMO_SPEAKING_SESSIONS, SPEAKING_MODES, findSpeakingMode } from '@/demo/speaking'
import { DEMO_STUDENT_SNAPSHOT } from '@/demo/student-home'
import { formatRelative } from '@/lib/utils'

export function SpeakPage() {
  const snapshot = DEMO_STUDENT_SNAPSHOT
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Speak"
        title="AI speaking coach"
        description="Pick a mode. The coach adapts to your level and the grammar you are working on."
        actions={<DemoNotice>AI conversations connect in M7.</DemoNotice>}
      />

      <Card className="border-brand-200/60 bg-gradient-to-br from-brand-50 to-surface dark:border-brand-800/60 dark:from-brand-950/60 dark:to-surface">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Today&apos;s speaking target</p>
            <p className="text-sm text-fg-muted tabular">
              {snapshot.speakingMinutesToday} of {snapshot.dailySpeakingTargetMinutes} minutes done. A short
              session keeps your streak alive.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/speak/free">
              <Mic aria-hidden /> Start talking
            </Link>
          </Button>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Practice modes" description="Each mode has explicit learning objectives." />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SPEAKING_MODES.map((mode) => (
            <li key={mode.id}>
              <Link
                to={`/speak/${mode.id}`}
                className="group block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Card className="flex h-full flex-col transition-[box-shadow,border-color] group-hover:border-line-strong group-hover:shadow-sm">
                  <CardContent className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold">{mode.title}</h3>
                      <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </div>
                    <p className="flex-1 text-sm text-fg-muted">{mode.tagline}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{mode.minLevel}+</Badge>
                      <Badge variant="neutral">
                        <Clock aria-hidden /> {mode.typicalMinutes} min
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <Card>
          <CardHeader>
            <SectionHeader title="Recent sessions" description="Coach notes are observations, not objective scores." />
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-line pt-0">
            {DEMO_SPEAKING_SESSIONS.map((session) => (
              <div key={session.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{session.title}</p>
                  <p className="text-xs text-fg-muted">
                    {findSpeakingMode(session.mode)?.title} · {session.durationMinutes} min · {session.turns} turns ·{' '}
                    {formatRelative(session.startedAt)}
                  </p>
                  <p className="mt-1 text-sm text-fg-muted italic">&ldquo;{session.coachNote}&rdquo;</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
