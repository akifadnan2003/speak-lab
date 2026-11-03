import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
        }
        className="w-full max-w-md border-none"
      />
    </div>
  )
}
