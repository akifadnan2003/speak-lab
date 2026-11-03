# SpeakLab — Architecture Decision Records

Format: context → decision → consequences. Newest at the bottom. Supersede rather than edit.

## ADR-001 · Static React SPA on GitHub Pages with a Supabase backend (2026-11-03)

**Context.** The frontend must be independently deployable to GitHub Pages without a Node server;
sensitive operations need a trusted backend.
**Decision.** Vite + React 19 + TypeScript static bundle; Supabase for Auth, Postgres with RLS,
Storage and Edge Functions. All privileged logic lives in Edge Functions.
**Consequences.** No SSR; auth and data are client-driven and policy-protected. AI providers are
only ever called server-side.

## ADR-002 · Tailwind CSS 4 with semantic tokens and Radix primitives (2026-11-03)

**Context.** Premium, consistent, themeable UI across phones and desktops with small bundle cost.
**Decision.** Tailwind 4 (`@theme inline`) over OKLCH CSS variables; Radix UI primitives wrapped
in shadcn-style components with `cva`; Lucide icons; Inter Variable self-hosted.
**Consequences.** Components never hardcode colours; dark mode is a class toggle; no runtime CSS-in-JS.

## ADR-003 · Hash routing for GitHub Pages (2026-11-03)

**Context.** GitHub Pages serves `index.html` only at the project root. Options: hash routing, or
browser routing with a `404.html` redirect trick that rewrites the path into a query string.
**Decision.** `createHashRouter`. URLs look like `/speak-lab/#/learn/a2-07`.
**Consequences.** Direct navigation, refresh and PWA `start_url` work without redirects or flashes.
Supabase auth redirects target the root URL; `?code=` arrives before the hash and is consumed by
supabase-js. Trade-off: hash URLs are slightly less elegant; a `404.html` copy is still emitted as a
safety net. Revisit only if moving to a host with rewrite rules.

## ADR-004 · Fail-closed guards plus an explicit M1 preview mode (2026-11-03)

**Context.** M1 must deliver reviewable UI shells before authentication exists, without implying
auth works and without ever rendering protected screens in production by accident.
**Decision.** `AuthProvider` returns `unauthenticated` unless `VITE_UI_PREVIEW=true` was set at
build time, in which case a fake local session is created, a persistent banner is shown and every
screen carries demo notices. The deploy workflow enables it for M1 only.
**Consequences.** Guards are exercised from day one. M2 must remove the flag from the workflow and
replace the preview branch with the Supabase session listener.

## ADR-005 · Demo data isolated in `src/demo/` (2026-11-03)

**Context.** Screens need realistic content to validate layout and hierarchy.
**Decision.** All fixtures live in `src/demo/*`, typed with the shapes the real data layer will
use, and are labelled in the UI by `DemoNotice`. Product configuration that is genuinely static
(speaking mode catalogue, feedback styles) is also kept there for now but is not demo data.
**Consequences.** Screens migrate to queries by swapping imports; no fixture ever reaches the DB.

## ADR-006 · PWA with prompt-based updates and no runtime caching (2026-11-03)

**Context.** Installability on iOS and Android; privacy of learner data.
**Decision.** `vite-plugin-pwa` generateSW, `registerType: 'prompt'`, precache the app shell only,
`runtimeCaching: []`.
**Consequences.** Updates never interrupt an exercise; private data is never cached by the SW.
Offline activities (M8) will use IndexedDB explicitly, not the SW cache.

## ADR-007 · Route-level code splitting (2026-11-03)

**Context.** A single bundle exceeded 750 kB on first build.
**Decision.** Every feature page is `lazy()`-loaded; `AppShell` and `AuthLayout` wrap outlets in
`Suspense`. Vite 8 (rolldown) default splitting is used; `manualChunks` is not available in the
rolldown API and `codeSplitting` groups were deferred.
**Consequences.** Initial chunk ≈ 455 kB raw (React, router, query, shell primitives); each screen
loads 1–15 kB more. Revisit with `build.rolldownOptions.output.codeSplitting` in M9.

## ADR-008 · Tooling versions (2026-11-03)

**Context.** `npm create vite` produced Vite 8, TypeScript 7 (native), oxlint, React 19.3.
**Decision.** Keep the scaffold's current stable toolchain: Vite 8 + rolldown, TypeScript 7
(`tsc -b`, `baseUrl` removed in favour of `paths`), oxlint instead of ESLint, Vitest 5, Playwright
1.64, Tailwind 4.3, React Router 8.
**Consequences.** Faster builds and checks. Some ecosystem docs still describe Vite 5/6 options
(e.g. `manualChunks`); check the installed types before adopting snippets.
