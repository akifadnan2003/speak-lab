import type { WeeklyActivityDay } from '@/demo/student-home'
import { cn } from '@/lib/utils'

interface Props {
  data: WeeklyActivityDay[]
  className?: string
}

/**
 * Accessible bar chart for weekly practice minutes (SVG-free, CSS bars).
 * Speaking minutes are drawn as a darker segment inside each day's bar.
 * The table markup is exposed to screen readers via `sr-only`.
 */
export function WeeklyActivityChart({ data, className }: Props) {
  const max = Math.max(30, ...data.map((d) => d.minutes))
  const total = data.reduce((sum, d) => sum + d.minutes, 0)
  const speaking = data.reduce((sum, d) => sum + d.speakingMinutes, 0)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-baseline justify-between text-sm">
        <p className="text-fg-muted">
          <span className="font-semibold text-fg tabular">{total}</span> min this week
        </p>
        <p className="flex items-center gap-3 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary/35" aria-hidden /> All practice
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden /> Speaking ({speaking})
          </span>
        </p>
      </div>
      <div className="grid h-36 grid-cols-7 items-end gap-2" aria-hidden>
        {data.map((day) => {
          const height = (day.minutes / max) * 100
          const speakingHeight = day.minutes ? (day.speakingMinutes / day.minutes) * 100 : 0
          return (
            <div key={day.day} className="flex h-full flex-col items-center justify-end gap-1.5">
              <div
                className="relative flex w-full max-w-9 items-end overflow-hidden rounded-md bg-primary/35 transition-[height] duration-500"
                style={{ height: `${Math.max(height, day.minutes ? 6 : 2)}%` }}
                title={`${day.day}: ${day.minutes} min (${day.speakingMinutes} speaking)`}
              >
                <div className="w-full rounded-b-md bg-primary" style={{ height: `${speakingHeight}%` }} />
              </div>
              <span className="text-[11px] font-medium text-fg-muted">{day.day}</span>
            </div>
          )
        })}
      </div>
      <table className="sr-only">
        <caption>Practice minutes by day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Minutes</th>
            <th scope="col">Speaking minutes</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.day}>
              <th scope="row">{day.day}</th>
              <td>{day.minutes}</td>
              <td>{day.speakingMinutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
