import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { env } from '@/config/env'
import { captureAuthRedirect } from '@/features/auth/auth-url'
import '@/styles/globals.css'

// Email links (invitation, password reset) carry auth material in the query string or the URL
// fragment. Capture and scrub it *before* the hash router mounts, otherwise the router would
// rewrite the fragment and the tokens would be lost. See src/features/auth/auth-url.ts.
captureAuthRedirect(window, env.basePath)

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
