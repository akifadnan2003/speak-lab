# SpeakLab — Design System

Last updated for milestone M1 (2026-11-03). Source of truth: `src/styles/globals.css` and
`src/components/ui/*`.

## 1. Principles

Modern and professional, beautiful but not childish. Clean typography, strong hierarchy, generous
spacing, subtle motion, consistent iconography, proper light and dark themes, honest states
(loading, empty, error, success), accessibility first. No gradient clutter, no fake controls, no
generic dashboard look.

Visual identity: navy and blue brand scale, neutral surfaces, restrained status and skill accents.

## 2. Tokens

Tokens are CSS custom properties on `:root` (light) and `.dark`, bound to Tailwind utilities via
`@theme inline`. Use the utility, never the raw value.

### Colour

| Utility | Token | Use |
| --- | --- | --- |
| `bg-canvas` | `--canvas` | Page background |
| `bg-surface` / `bg-surface-2` / `bg-surface-3` | surfaces | Cards, subtle fills, tracks |
| `bg-overlay` | `--overlay` | Dialogs, menus |
| `text-fg` / `text-fg-muted` / `text-fg-subtle` | foreground scale | Body, secondary, tertiary |
| `text-fg-on-primary` | | Text on primary fills |
| `border-line` / `border-line-strong` | lines | Dividers, inputs |
| `bg-primary` / `hover:bg-primary-hover` | brand action | Primary buttons, active nav |
| `bg-primary-soft` + `text-primary-soft-fg` | soft brand | Active nav fill, chips |
| `outline-ring` | `--ring` | Focus rings |
| `*-success`, `*-warning`, `*-danger`, `*-info` (+ `-soft`, `-soft-fg`) | status | Badges, notices |
| `bg-skill-grammar|vocabulary|speaking|listening|reading|writing` | skill accents | Chart bars, chips |
| `brand-50 … brand-950` | brand scale | Rare direct use (hero cards) |

Colours are defined in OKLCH for perceptual consistency between themes.

### Typography

Inter Variable (self-hosted via `@fontsource-variable/inter`), system fallback. Base size 15px,
line-height 1.5. Headings use `tracking-tight` / `-0.015em` and `text-wrap: balance`. Numeric data
uses the `tabular` utility.

| Role | Classes |
| --- | --- |
| Page title | `text-2xl sm:text-3xl font-semibold tracking-tight` |
| Section title | `text-base font-semibold` |
| Card title | `text-base font-semibold leading-tight` |
| Body | default |
| Secondary | `text-sm text-fg-muted` |
| Eyebrow | `text-xs font-semibold uppercase tracking-wide text-primary` |

### Spacing, radius, elevation

Tailwind spacing scale. Page gutters: `px-4 sm:px-6 lg:px-8`. Section gaps `gap-6`. Card padding
`p-4` (dense) or `px-5 py-5`.
Radius: `--radius: 0.75rem`; `rounded-lg` (controls), `rounded-xl` (cards), `rounded-2xl`
(dialogs). Shadows: `shadow-xs` (cards), `shadow-sm` (hover), `shadow-md` (floating), `shadow-lg`
(overlays).

### Motion

`animate-fade-in`, `animate-slide-up`, `animate-slide-in-left`, `animate-scale-in` (160–240 ms,
ease-out). Progress bars animate width over 500 ms. `prefers-reduced-motion` disables all of it.

### Layout tokens

`--sidebar-width` 16.5rem (`lg:pl-sidebar`), `--topbar-height` 3.75rem, `--bottomnav-height` 4rem,
`--safe-*` from `env(safe-area-inset-*)`. The app shell pads content for the bottom bar and the
iOS home indicator.

## 3. Theme

`.dark` on `<html>`. Preference (`light | dark | system`) is stored in `localStorage` under
`speaklab.theme` and applied by an inline script before first paint to avoid flashes. The Zustand
store in `src/components/theme/theme-store.ts` keeps React in sync and listens to OS changes when
the preference is `system`.

## 4. Components

All primitives live in `src/components/ui/` and accept `className` for composition.

| Component | Notes |
| --- | --- |
| `Button` | Variants `primary, secondary, outline, ghost, soft, danger, link`; sizes `sm, md, lg, icon, icon-sm`; `loading`, `asChild`. |
| `Card*` | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter. |
| `Badge` | `neutral, outline, primary, success, warning, danger, info`. |
| `Input`, `Textarea` | 44px tall on phones (prevents iOS zoom with 16px text), 40px on desktop. |
| `Label`, `Field`, `FieldHint`, `FieldError` | Form scaffolding; errors use `role="alert"`. |
| `Dialog*` | Bottom sheet on phones, centred modal from `sm`. Focus trapped, Escape closes. |
| `Sheet*` | Side drawer (mobile navigation). |
| `Tabs*` | Horizontally scrollable list; arrow-key navigation. |
| `Progress`, `ProgressRing` | Linear bar and SVG ring with ARIA progressbar semantics. |
| `Switch` | Radix switch. |
| `Avatar` | Image with initials fallback. |
| `Skeleton` | Loading placeholder. |
| `Tooltip*` | Provider at app root. |
| `DropdownMenu*` | Account menu, theme menu (radio items). |
| `Select*` | Popper positioned, keyboard friendly. |
| `Separator` | Horizontal/vertical. |
| `EmptyState` | Icon, title, description, action; `compact` variant. |
| `PageHeader`, `SectionHeader` | Eyebrow / title / description / actions. |
| `Stat` | Metric tile with icon tone. |

Layout: `AppShell` (sidebar ≥ `lg`, top bar, bottom nav < `lg`, skip link, preview banner),
`AuthLayout`. Feedback: `FullPageLoader`, `DemoNotice`, `PreviewBanner`, `AppErrorBoundary`,
`UpdatePrompt`.

## 5. Responsive rules

Breakpoints: Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). Verified widths: 320,
375, 390, 430, 768, 1024, 1440 (Playwright overflow checks).

- Phones: single column, bottom navigation, 44px+ touch targets, no horizontal overflow,
  `viewport-fit=cover`, safe-area padding, dialogs as bottom sheets, horizontally scrollable tab
  lists and level cards.
- Tablets: two-column grids, drawer navigation.
- Desktop: fixed sidebar, multi-column student cards, wide tables inside `overflow-x-auto`.

## 6. Accessibility

Visible focus rings (`:focus-visible`), skip link, semantic landmarks (`header`, `nav`, `main`,
`aside`), ARIA on custom radio groups and progress, `aria-live` on status text, hidden data tables
behind charts, labelled icon buttons, colour never the only signal (badges carry text).

## 7. Charts

`WeeklyActivityChart` is CSS/HTML with a screen-reader table. Charts only render real data once
analytics exist; demo screens show the `DemoNotice`.
