import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium',
    'transition-[background-color,color,box-shadow,transform] duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98]',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-fg-on-primary shadow-xs hover:bg-primary-hover',
        secondary: 'bg-surface-2 text-fg hover:bg-surface-3',
        outline: 'border border-line-strong bg-surface text-fg shadow-xs hover:bg-surface-2',
        ghost: 'text-fg hover:bg-surface-2',
        soft: 'bg-primary-soft text-primary-soft-fg hover:bg-brand-100 dark:hover:bg-brand-800/60',
        danger: 'bg-danger text-fg-on-primary shadow-xs hover:brightness-95',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-base',
        icon: 'size-10',
        'icon-sm': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className)

  // Slot requires exactly one child, so the loading spinner is only rendered
  // for real <button> elements.
  if (asChild) {
    return (
      <Slot data-slot="button" className={classes} aria-disabled={disabled || undefined} {...props}>
        {children}
      </Slot>
    )
  }

  return (
    <button
      data-slot="button"
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
}

export { buttonVariants }
