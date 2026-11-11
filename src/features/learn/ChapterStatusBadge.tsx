import { CheckCircle2, Lock, PenLine, PlayCircle, SkipForward } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ChapterState } from '@/features/curriculum/progression'

export function ChapterStatusBadge({ state }: { state: ChapterState }) {
  if (state.chapter.status === 'planned') {
    return (
      <Badge variant="outline">
        <PenLine aria-hidden /> Not written yet
      </Badge>
    )
  }
  switch (state.status) {
    case 'completed':
      return (
        <Badge variant="success">
          <CheckCircle2 aria-hidden /> Completed
        </Badge>
      )
    case 'in_progress':
      return (
        <Badge variant="primary">
          <PlayCircle aria-hidden /> In progress
        </Badge>
      )
    case 'available':
      return <Badge variant="info">Ready to start</Badge>
    case 'skipped':
      return (
        <Badge variant="neutral">
          <SkipForward aria-hidden /> Skipped by tutor
        </Badge>
      )
    default:
      return (
        <Badge variant="outline">
          <Lock aria-hidden /> Locked
        </Badge>
      )
  }
}
