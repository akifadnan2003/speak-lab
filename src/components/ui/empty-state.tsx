import type { ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps extends ComponentProps<'div'> {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  /** Compact variant for use inside cards. */
  compact?: boolean
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
        className,
      )}
      {...props}
    >
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="max-w-sm text-sm text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
