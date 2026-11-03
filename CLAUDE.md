# CLAUDE.md — SpeakLab working conventions

This file is read at the start of every Claude Code session. Keep it short, current and specific.

## What this is

SpeakLab: invitation-only, speaking-first English academy for a single tutor (the repository owner)
and their students. Mobile-first PWA on GitHub Pages at `/speak-lab/`, Supabase backend.
Full spec: `docs/PRODUCT_SPEC.md`. Roadmap and current milestone: `docs/ROADMAP.md`.

## Non-negotiables (never regress)

- No public sign-up. Accounts exist only through tutor invitations (Supabase admin invite).
- Exactly one role can be Tutor/Admin: the owner. Role is never derived from client data.
- Students never see other students' data. RLS on every student-scoped table.
- Service-role keys and AI provider keys never reach the browser. Privileged work runs in Edge
  Functions. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public.
- Protected routes fail closed. `VITE_UI_PREVIEW` is an M1-only review switch; remove it from the
  deploy workflow when M2 ships.
- No fake buttons. If a feature is not connected, say so in the UI (`<DemoNotice>`), disable the
  control, or do not render it.
- Demo data lives only in `src/demo/` and is labelled as such.

## Commands

`npm run dev` · `npm run typecheck` · `npm run lint` · `npm run test` · `npm run test:e2e` ·
`npm run build` · `npm run check` (all of the first four plus build).

Never claim a check passed without running it. Never delete a meaningful test to make CI green.

## Code conventions

- TypeScript strict, `noUncheckedIndexedAccess` on. No `any`.
- Imports use the `@/` alias. Feature code lives in `src/features/<feature>/`.
- Curriculum content is data: author chapters in `src/features/curriculum/content/chapters/` with
  the helpers in `content/authoring.ts`, register them in `curriculum-map.ts`, never in components.
  Exercise grading and progression rules are pure functions in `src/features/exercises/engine/` and
  `src/features/curriculum/progression.ts`; screens talk to persistence only through
  `src/features/curriculum/ports.ts`.
- UI primitives in `src/components/ui/` follow the shadcn pattern (Radix + `cva` + `cn`).
- Styling: Tailwind 4 utilities bound to semantic tokens (`bg-surface`, `text-fg-muted`,
  `border-line`, `bg-primary`, status `*-soft` colours). Do not hard-code hex colours in components.
  Tokens: `src/styles/globals.css`, reference: `docs/DESIGN_SYSTEM.md`.
- Dark mode is the `.dark` class on `<html>`; use the `dark:` variant only when a token cannot do it.
- Routing: `createHashRouter` (GitHub Pages). Feature pages are `lazy()`-loaded in
  `src/app/router.tsx`. Guards in `src/features/auth/guards.tsx`.
- Server state: TanStack Query. Client-only state: Zustand only when a context would be awkward.
- Forms: React Hook Form + Zod schemas colocated with the form.
- Icons: `lucide-react`, `aria-hidden` unless the icon is the only label.
- Touch targets ≥ 44px on mobile, visible focus rings, `aria-*` on custom controls.
- Mobile first: check 320, 375, 390, 430, 768, 1024 widths. No horizontal overflow.

## Testing conventions

- Unit/integration: Vitest + Testing Library, colocated `*.test.ts(x)`. Setup in `src/test/setup.ts`.
- Routing/guard tests mock `@/config/env` (see `src/app/router.test.tsx`).
- E2E: Playwright in `e2e/`, runs against the production build with preview mode.
- Every milestone adds tests for what it introduces. Authorization tests (RLS) arrive in M2.

## Documentation upkeep

Update `docs/DECISIONS.md` for any architectural change, `docs/ROADMAP.md` at milestone boundaries,
and the relevant doc when behaviour changes. Keep this file accurate.

## Git

Work on `main` with small, meaningful commits. Run `npm run check` before committing. Commit
messages: imperative subject, body explaining why. Do not push broken builds; the deploy workflow
publishes `main` automatically.
