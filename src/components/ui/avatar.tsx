import * as AvatarPrimitive from '@radix-ui/react-avatar'
import type { ComponentProps } from 'react'
import { cn, initials } from '@/lib/utils'

interface AvatarProps extends ComponentProps<typeof AvatarPrimitive.Root> {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
}

export function Avatar({ name, src, size = 'md', className, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full bg-primary-soft text-primary-soft-fg',
        sizes[size],
        className,
      )}
      {...props}
    >
      {src ? <AvatarPrimitive.Image src={src} alt="" className="aspect-square size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback
        className="flex size-full items-center justify-center font-semibold tracking-wide"
        delayMs={src ? 300 : 0}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
