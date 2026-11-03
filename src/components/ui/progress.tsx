import * as ProgressPrimitive from '@radix-ui/react-progress'
import type { ComponentProps } from 'react'
import { clamp, cn } from '@/lib/utils'

interface ProgressProps extends ComponentProps<typeof ProgressPrimitive.Root> {
  value: number
  /** Tailwind bg class for the indicator; defaults to the primary colour. */
  indicatorClassName?: string
  size?: 'sm' | 'md'
}

export function Progress({
  className,
  value,
  indicatorClassName,
  size = 'md',
  ...props
}: ProgressProps) {
  const safe = clamp(Math.round(value), 0, 100)
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={safe}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-surface-3',
        size === 'sm' ? 'h-1.5' : 'h-2.5',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-500 ease-out',
          indicatorClassName,
        )}
        style={{ width: `${safe}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

interface RingProps {
  value: number
  size?: number
  stroke?: number
  className?: string
  label?: string
  children?: React.ReactNode
}

/** Circular progress ring (SVG, no external chart lib). */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  className,
  label,
  children,
}: RingProps) {
  const safe = clamp(value, 0, 100)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - safe / 100)
  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(safe)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="fill-none stroke-surface-3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="fill-none stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
