import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-950 text-brand-400 dark:bg-brand-500 dark:text-white',
        className,
      )}
    >
      <svg viewBox="0 0 64 64" className="size-5" fill="currentColor">
        <path d="M26 14h12a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8h-6.5L22 46.5V38a8 8 0 0 1-4-7v-9a8 8 0 0 1 8-8z" />
        <circle cx="26" cy="27" r="2.6" className="fill-brand-950 dark:fill-brand-500" />
        <circle cx="33" cy="27" r="2.6" className="fill-brand-950 dark:fill-brand-500" />
        <circle cx="40" cy="27" r="2.6" className="fill-brand-950 dark:fill-brand-500" />
      </svg>
    </span>
  )
}

export function Brand({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-2.5 rounded-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      aria-label="SpeakLab home"
    >
      <BrandMark />
      <span className="text-base">SpeakLab</span>
    </Link>
  )
}
