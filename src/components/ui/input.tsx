import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3.5 text-base text-fg shadow-xs sm:h-10 sm:text-sm',
        'placeholder:text-fg-subtle',
        'transition-[border-color,box-shadow] duration-150',
        'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-danger aria-invalid:ring-danger/30',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-24 w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-base text-fg shadow-xs sm:text-sm',
        'placeholder:text-fg-subtle',
        'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-danger aria-invalid:ring-danger/30',
        className,
      )}
      {...props}
    />
  )
}
