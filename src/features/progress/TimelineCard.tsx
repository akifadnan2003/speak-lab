import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'
import { ActivityList } from './ActivityList'
import type { TimelineEvent } from './analytics'
import { toActivityItems } from './labels'

/** Chronological learning history backed by stored records; every entry has a stable id. */
export function TimelineCard({ events, limit, timeline = false, title = 'Learning history' }: { events: readonly TimelineEvent[]; limit?: number; timeline?: boolean; title?: string }) {
  const shown = limit ? events.slice(0, limit) : events
  return (
    <Card data-testid="timeline-card">
      <CardHeader>
        <SectionHeader title={title} description={limit ? undefined : 'Lessons completed, chapter checks and vocabulary milestones, newest first.'} as="h2" />
      </CardHeader>
      <CardContent className="pt-0">
        {shown.length === 0 ? (
          <p className="text-sm text-fg-muted" data-testid="timeline-empty">
            Your history starts with your first completed lesson or vocabulary review.
          </p>
        ) : (
          <ActivityList items={toActivityItems(shown)} timeline={timeline} />
        )}
        {limit && events.length > limit ? (
          <p className="mt-3 text-xs text-fg-subtle">
            {events.length - limit} earlier {events.length - limit === 1 ? 'entry' : 'entries'} on the Progress page.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
