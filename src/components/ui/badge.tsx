import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3',
  {
    variants: {
      variant: {
        neutral: 'border-transparent bg-surface-2 text-fg-muted',
        outline: 'border-line-strong bg-transparent text-fg-muted',
        primary: 'border-transparent bg-primary-soft text-primary-soft-fg',
        success: 'border-transparent bg-success-soft text-success-soft-fg',
        warning: 'border-transparent bg-warning-soft text-warning-soft-fg',
        danger: 'border-transparent bg-danger-soft text-danger-soft-fg',
        info: 'border-transparent bg-info-soft text-info-soft-fg',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
