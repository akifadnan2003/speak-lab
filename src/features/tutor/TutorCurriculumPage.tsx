import { BookOpen } from 'lucide-react'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { DEMO_LEVELS } from '@/demo/curriculum'

/** Tutor-side curriculum management shell. Content editing arrives with M3. */
export function TutorCurriculumPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Tutor dashboard"
        title="Curriculum"
        description="Levels, chapters and lessons. Manage learning paths and unlock rules per student."
        actions={<DemoNotice>Content management opens in M3.</DemoNotice>}
      />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_LEVELS.map((level) => (
          <li key={level.level}>
            <Card>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{level.level}</span>
                  <Badge variant="neutral">{level.chapters} chapters</Badge>
                </div>
                <p className="text-sm font-medium">{level.name}</p>
                <p className="text-sm text-fg-muted">{level.description}</p>
                <Progress value={(level.completedChapters / level.chapters) * 100} size="sm" />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      <EmptyState
        icon={BookOpen}
        title="Content editor not available yet"
        description="Chapters and exercises will be editable here once the versioned content engine ships."
      />
    </div>
  )
}
