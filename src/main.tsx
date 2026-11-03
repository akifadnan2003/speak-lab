import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { env } from '@/config/env'
import { captureAuthRedirect } from '@/features/auth/auth-url'
import '@/styles/globals.css'

// Email links (invitation, password reset) carry auth material in the query string or the URL
// fragment. Capture and scrub it *before* the router module is evaluated: `createHashRouter`
// reads `window.location` the moment `src/app/router.tsx` loads, so `App` is imported
// dynamically after the address bar has been rewritten to `#/auth/callback?flow=…`.
// See src/features/auth/auth-url.ts.
captureAuthRedirect(window, env.basePath)

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

void import('@/app/App').then(({ App }) => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
