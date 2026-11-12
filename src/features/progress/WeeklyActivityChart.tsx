import { cn } from '@/lib/utils'
import type { WeeklyActivity } from './analytics'

/**
 * Seven-day activity as stacked CSS bars (no chart library): lessons completed, exercises
 * practised, vocabulary reviews and chapter checks per calendar day in the learner's time zone.
 * Counts, never minutes: the app does not measure time on task. A `sr-only` table carries the
 * same numbers for screen readers. Works down to 320 px: seven columns with 4 px gaps.
 */
const SEGMENTS = [
  { key: 'lessonsCompleted', label: 'Lessons', className: 'bg-skill-grammar' },
  { key: 'exercisesPractised', label: 'Exercises', className: 'bg-primary/55' },
  { key: 'vocabularyReviews', label: 'Vocabulary', className: 'bg-skill-vocabulary' },
  { key: 'checksSubmitted', label: 'Chapter checks', className: 'bg-warning' },
] as const

export function WeeklyActivityChart({ weekly, className }: { weekly: WeeklyActivity; className?: string }) {
  const max = Math.max(5, ...weekly.days.map((d) => d.total))
  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="weekly-activity" data-total={weekly.totals.total}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p className="text-fg-muted">
          <span className="font-semibold text-fg tabular">{weekly.totals.total}</span> {weekly.totals.total === 1 ? 'activity' : 'activities'} on{' '}
          <span className="font-semibold text-fg tabular">{weekly.activeDays}</span> of the last 7 days
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted" aria-label="Legend">
          {SEGMENTS.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2.5 rounded-sm', s.className)} aria-hidden /> {s.label} ({weekly.totals[s.key]})
            </li>
          ))}
        </ul>
      </div>
      <div className="grid h-36 grid-cols-7 items-end gap-1 sm:gap-2" aria-hidden>
        {weekly.days.map((day) => {
          const height = (day.total / max) * 100
          return (
            <div key={day.day} className="flex h-full flex-col items-center justify-end gap-1.5">
              <div
                className={cn('flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-md bg-surface-3 transition-[height] duration-500', day.isToday && 'ring-2 ring-primary/40')}
                style={{ height: `${Math.max(height, day.total ? 6 : 3)}%` }}
                title={`${day.label}: ${day.total} ${day.total === 1 ? 'activity' : 'activities'}`}
              >
                {day.total > 0
                  ? SEGMENTS.map((s) => (
                      <div key={s.key} className={cn('w-full', s.className)} style={{ height: `${(day[s.key] / day.total) * 100}%` }} />
                    ))
                  : null}
              </div>
              <span className={cn('text-[11px] font-medium text-fg-muted', day.isToday && 'text-fg')}>{day.label}</span>
            </div>
          )
        })}
      </div>
      {/* Wrapped: a table keeps its content width even when sr-only, which caused horizontal overflow on phones. */}
      <div className="sr-only">
      <table>
        <caption>Learning activity by day, last seven days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {SEGMENTS.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekly.days.map((day) => (
            <tr key={day.day}>
              <th scope="row">{day.day}</th>
              {SEGMENTS.map((s) => (
                <td key={s.key}>{day[s.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
