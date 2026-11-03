import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    listeners.forEach((listener) => listener())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((listener) => listener())
  })
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    nav.standalone === true
  )
}

/**
 * Exposes the Chromium/Android install prompt. iOS Safari has no programmatic
 * install API, so callers show manual instructions when `canInstall` is false.
 */
export function usePwaInstall() {
  const [, force] = useState(0)
  useEffect(() => {
    const listener = () => force((n) => n + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    deferredPrompt = null
    force((n) => n + 1)
  }, [])

  return { canInstall: deferredPrompt !== null, promptInstall, installed: isStandalone() }
}
