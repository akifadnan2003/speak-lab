import * as LabelPrimitive from '@radix-ui/react-label'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'text-sm font-medium leading-none text-fg select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function FieldHint({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-xs text-fg-muted', className)} {...props} />
}

export function FieldError({ className, children, ...props }: ComponentProps<'p'>) {
  if (!children) return null
  return (
    <p role="alert" className={cn('text-xs font-medium text-danger', className)} {...props}>
      {children}
    </p>
  )
}

export function Field({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />
}
