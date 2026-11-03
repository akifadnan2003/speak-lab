import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

/**
 * Service-worker lifecycle UI. `registerType: 'prompt'` means a new build is
 * never applied silently while the student is mid-exercise; they choose when
 * to reload.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('[speaklab] Service worker registration failed', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(var(--bottomnav-height)+var(--safe-bottom)+0.75rem)] z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-line bg-overlay p-3 shadow-lg animate-slide-up lg:bottom-6"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">Update available</p>
        <p className="text-xs text-fg-muted">Reload to get the latest version of SpeakLab.</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          <RefreshCw aria-hidden /> Reload
        </Button>
      </div>
    </div>
  )
}
