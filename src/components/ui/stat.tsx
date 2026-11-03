import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatProps {
  label: string
  value: ReactNode
  hint?: string
  icon?: LucideIcon
  tone?: 'default' | 'primary' | 'success' | 'warning'
  className?: string
}

const toneClasses = {
  default: 'bg-surface-2 text-fg-muted',
  primary: 'bg-primary-soft text-primary-soft-fg',
  success: 'bg-success-soft text-success-soft-fg',
  warning: 'bg-warning-soft text-warning-soft-fg',
}

/** Compact metric tile. Values are expected to be real data; see docs/PRODUCT_SPEC.md. */
export function Stat({ label, value, hint, icon: Icon, tone = 'default', className }: StatProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs',
        className,
      )}
    >
      {Icon ? (
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', toneClasses[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-fg-muted">{label}</p>
        <p className="mt-0.5 text-xl font-semibold tabular leading-tight">{value}</p>
        {hint ? <p className="mt-0.5 truncate text-xs text-fg-subtle">{hint}</p> : null}
      </div>
    </div>
  )
}
