# SpeakLab

A premium, mobile-first, AI-powered English academy. Invitation-only, speaking-first, built for a
tutor and their students.

**Production:** https://speaklab.akiflabs.net/ (custom domain on GitHub Pages; the old
`akifadnan2003.github.io/speak-lab/` address redirects here)
**Status:** Milestone M2 complete (authentication, authorization, invitations). See
[`docs/ROADMAP.md`](docs/ROADMAP.md).

> The deployed site uses real Supabase authentication. There is no public sign-up: the tutor
> invites students by email, and every table is protected by Row Level Security. Lessons,
> vocabulary and progress screens still show clearly-labelled sample content until M3–M5.
> Owner setup steps (email templates, backend deployment, owner bootstrap) are in
> [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).

## Stack

React 19 · TypeScript (strict) · Vite 8 · Tailwind CSS 4 · Radix UI primitives · Lucide icons ·
React Router 8 (hash routing) · TanStack Query · Zustand · React Hook Form + Zod · Supabase (Auth,
Postgres, RLS, Storage, Edge Functions) · vite-plugin-pwa · Vitest + Testing Library · Playwright ·
GitHub Actions → GitHub Pages.

## Development

```bash
npm install
cp .env.example .env.local        # local Supabase values from `npx supabase status`; never commit secrets
npx supabase start                # local Postgres/Auth/Edge Functions/Mailpit (needs Docker)
npm run dev                       # http://localhost:5173/
```

To review the UI shells without a backend, leave the Supabase values empty and set
`VITE_UI_PREVIEW=true` in `.env.local` (preview is refused whenever Supabase is configured).

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc -b` with strict settings |
| `npm run lint` | oxlint |
| `npm run test` | Vitest unit and integration tests |
| `npm run test:e2e` | Playwright shell suite (preview build) |
| `npm run test:db` | Authorization / lifecycle tests against the local Supabase stack |
| `npm run test:e2e:auth` | Real invitation, recovery and disable flows in the browser (local stack) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve `dist/` locally at `/` (as on the custom domain) |
| `npm run check` | typecheck + lint + test + build |
| `npm run icons` | Regenerate PWA icons from `public/icon-source.svg` |

First time running Playwright: `npm run test:e2e:install`.

## Project layout

```
src/
  app/            App providers, router, PWA hooks
  components/     ui/ (primitives), layout/ (shell), theme/, feedback/
  config/         Validated environment access
  demo/           Clearly-labelled demonstration data (preview mode and placeholders)
  features/       auth, dashboard, learn, lesson, speak, vocabulary, progress, tutor, settings
  lib/            Utilities and the Supabase client factory
  styles/         Design tokens and global CSS
  test/           Vitest setup
e2e/              Playwright specs (shell.spec.ts, auth.spec.ts)
supabase/         config.toml, migrations/, functions/student-admin, templates/, tests/
docs/             Product, architecture, curriculum, design, security, roadmap, decisions, testing
.github/          CI and GitHub Pages deployment
```

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — conventions for AI-assisted development sessions
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/CURRICULUM.md`](docs/CURRICULUM.md)
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/DECISIONS.md`](docs/DECISIONS.md)
- [`docs/TESTING.md`](docs/TESTING.md)

## Licence

Private project. All rights reserved.
