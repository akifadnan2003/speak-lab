import { Award, BookOpen, ClipboardList, Layers, Mic, Trophy, UserCheck, type LucideIcon } from 'lucide-react'
import { formatRelative } from '@/lib/utils'

export interface ActivityListItem {
  id: string
  type: 'lesson' | 'speaking' | 'vocabulary' | 'assessment' | 'assignment' | 'achievement' | 'account'
  title: string
  detail: string
  at: string
}

const ICONS: Record<ActivityListItem['type'], { icon: LucideIcon; className: string }> = {
  lesson: { icon: BookOpen, className: 'bg-primary-soft text-primary-soft-fg' },
  speaking: { icon: Mic, className: 'bg-success-soft text-success-soft-fg' },
  vocabulary: { icon: Layers, className: 'bg-info-soft text-info-soft-fg' },
  assessment: { icon: Trophy, className: 'bg-warning-soft text-warning-soft-fg' },
  assignment: { icon: ClipboardList, className: 'bg-surface-2 text-fg-muted' },
  achievement: { icon: Award, className: 'bg-warning-soft text-warning-soft-fg' },
  account: { icon: UserCheck, className: 'bg-surface-2 text-fg-muted' },
}

export function ActivityList({ items, timeline = false }: { items: ActivityListItem[]; timeline?: boolean }) {
  return (
    <ol className={timeline ? 'relative flex flex-col gap-5 border-l border-line pl-6' : 'flex flex-col divide-y divide-line'}>
      {items.map((item) => {
        const meta = ICONS[item.type]
        return (
          <li key={item.id} className={timeline ? 'relative' : 'flex items-start gap-3 py-3 first:pt-0 last:pb-0'}>
            {timeline ? (
              <span
                className={`absolute -left-[2.05rem] top-0 flex size-7 items-center justify-center rounded-full ring-4 ring-surface ${meta.className}`}
              >
                <meta.icon className="size-3.5" aria-hidden />
              </span>
            ) : (
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.className}`}>
                <meta.icon className="size-4" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="text-xs text-fg-muted">{item.detail}</p>
            </div>
            <time dateTime={item.at} className={`shrink-0 text-xs text-fg-subtle ${timeline ? 'absolute right-0 top-0' : ''}`}>
              {formatRelative(item.at)}
            </time>
          </li>
        )
      })}
    </ol>
  )
}
