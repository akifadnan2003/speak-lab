import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Top-level error boundary: shows a recoverable error screen instead of a blank page. */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // M9 will forward this to an error-monitoring service.
    console.error('[speaklab] Unhandled render error', error, info.componentStack)
  }

  private reset = () => {
    this.setState({ error: null })
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger-soft-fg">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-fg-muted">
            The screen could not be displayed. Your progress is saved on the server, so it is safe to
            try again.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={this.reset}>
            Try again
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden /> Reload
          </Button>
        </div>
      </div>
    )
  }
}
