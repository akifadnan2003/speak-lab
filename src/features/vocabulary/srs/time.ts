/**
 * Date helpers for scheduling. Instants are ISO strings in UTC; calendar
 * days ("today", streaks) are computed in the learner's time zone, which is
 * injectable so tests are deterministic.
 */

export const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS)
}

/** `YYYY-MM-DD` of an instant in the given time zone (defaults to the device zone). */
export function dateKey(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Whole days from key `a` to key `b` (positive when b is later). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((Date.UTC(...splitKey(b)) - Date.UTC(...splitKey(a))) / DAY_MS)
}

function splitKey(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number)
  return [y ?? 1970, (m ?? 1) - 1, d ?? 1]
}

export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}
