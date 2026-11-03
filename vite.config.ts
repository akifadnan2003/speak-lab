import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * SpeakLab is deployed as a GitHub Pages *project* site, so everything lives
 * under `/speak-lab/`. The base path drives asset URLs, the PWA scope and the
 * service-worker registration. Override with VITE_BASE_PATH for local
 * experiments (for example `/`).
 */
const BASE_PATH = process.env.VITE_BASE_PATH ?? '/speak-lab/'

// A build must never combine the demo preview session with a real backend. `config/env.ts`
// also refuses it at runtime; failing the build makes the mistake impossible to deploy.
if ((process.env.VITE_UI_PREVIEW === 'true' || process.env.VITE_UI_PREVIEW === '1') && process.env.VITE_SUPABASE_URL) {
  throw new Error('VITE_UI_PREVIEW cannot be enabled when VITE_SUPABASE_URL is set. Preview mode is for builds without a backend only.')
}

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180x180.png'],
      manifest: {
        id: BASE_PATH,
        name: 'SpeakLab',
        short_name: 'SpeakLab',
        description: 'A premium, speaking-first English academy with an AI coach.',
        lang: 'en',
        dir: 'ltr',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1220',
        theme_color: '#0b1220',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Only the application shell is precached. Private learner data,
        // recordings and API responses are never cached by the service worker.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE_PATH}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
    target: 'es2022',
  },
})
