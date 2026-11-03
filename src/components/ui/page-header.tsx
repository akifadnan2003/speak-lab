import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps extends ComponentProps<'header'> {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-fg-muted sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
  as: Tag = 'h2',
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  as?: 'h2' | 'h3'
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <Tag className="text-base font-semibold leading-tight">{title}</Tag>
        {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
