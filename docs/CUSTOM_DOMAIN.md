# Custom domain migration runbook: `speaklab.akiflabs.net`

Status: code prepared on branch `custom-domain-migration` (ADR-020). DNS, the GitHub Pages custom
domain, the DNS check, HTTPS enforcement and the certificate are already done by the owner. This
document lists what the code change does, what the owner still has to change by hand, how to
verify, and how to roll back. Nothing in Supabase (accounts, progress, vocabulary, tutor
ownership) changes.

## 1. What changes in the repository

| Area | Change |
| --- | --- |
| Vite | `base` defaults to `/`; `VITE_BASE_PATH` still overrides it for a sub-path build. |
| PWA | `manifest.id`, `start_url`, `scope`, the precache list and `navigateFallback` follow the base path, so they are now `/`. The service worker is registered at `/sw.js` with scope `/`. |
| Deploy workflow | Builds with `VITE_BASE_PATH=/`, fails if `/speak-lab/` is still referenced in `index.html`, the manifest, the service worker or any asset, and fails if `dist/CNAME` is missing. |
| `public/CNAME` | `speaklab.akiflabs.net`, copied into every artifact so the custom domain is never dropped by a deployment. (With `actions/deploy-pages` the domain also lives in the repository's Pages settings; the file is belt and braces and required if the deployment method ever changes to a branch.) |
| Routing | Hash routing unchanged. `404.html` + `.nojekyll` still emitted. |
| Auth | No code change: `appRedirectUrl()` already uses `window.location.origin` + base path, `captureAuthRedirect()` and the `token_hash` flow are path-agnostic, implicit-grant fragments are still rejected. `env.basePath` defaults to `/`. |
| Edge Functions | `student-admin` default allow-list: custom domain first, old URL kept during the migration, localhost at `/`. The manual backend workflow sets `SPEAKLAB_ALLOWED_APP_URLS` to the same. `assessment` has no hostname or path assumption (it only uses `SUPABASE_URL`). |
| Local stack | `supabase/config.toml` site URL and redirect URLs at `/`. |
| Tests | Playwright base URL `/`; shell tests assert the root manifest/scope, no `/speak-lab/` in the shell, the CNAME, and that the old path is not served. |

## 2. Owner actions, in order (none are done by the code)

1. **Supabase Dashboard → Authentication → URL Configuration** (after merging):
   - Site URL: `https://speaklab.akiflabs.net/`
   - Redirect URLs: add `https://speaklab.akiflabs.net/`; keep `https://akifadnan2003.github.io/speak-lab/`
     for now; replace `http://localhost:5173/speak-lab/` and `http://localhost:4173/speak-lab/`
     with `http://localhost:5173/` and `http://localhost:4173/`.
2. **Merge the PR.** The Pages deployment runs automatically and publishes the root-based build
   with the CNAME.
3. **Run the manual backend workflow** (`Supabase backend (manual)`): migrations are already
   applied (the plan must be empty); the run redeploys both functions unchanged and sets
   `SPEAKLAB_ALLOWED_APP_URLS` to the new list. Dry run first as usual. Redeploying the functions
   is needed only for the secret; the default list in `student-admin` is also updated in code.
4. **Email templates**: still blocked behind custom SMTP (see `SUPABASE_SETUP.md` §1.3). When SMTP
   is configured, paste the templates as documented; they use `{{ .SiteURL }}`-independent
   `token_hash` links to the app URL, so the Site URL above must be correct first.
5. After the invitation/recovery OTP expiry (default 1 h, see Auth → Emails) has passed since the
   last email sent with the old address, remove `https://akifadnan2003.github.io/speak-lab/` from
   the Redirect URLs and from `SPEAKLAB_ALLOWED_APP_URLS` (workflow + function default).

## 3. Existing users and device data

- All accounts, roles, links, progress, attempts, vocabulary records and events are untouched.
- Sessions are per origin: every user signs in again once at the new address. The old address
  redirects there, so bookmarks and the installed PWA's old start URL still open the app, but
  the old PWA installation should be removed and the app installed again from the new origin
  (its manifest `id` changed from `/speak-lab/` to `/`).
- **Offline work queued on the old origin cannot be flushed any more**: the old origin is no
  longer served, so its `localStorage` (M4 vocabulary outbox `speaklab.vocab.outbox.v1:<uid>`) is
  unreachable from the app. Before the DNS switch this could have been drained by opening the old
  URL online; after it, it is lost. To check whether anyone was affected, compare for each student
  the last `vocabulary_reviews.received_at` with what they report, or simply tell students that
  answers given offline before the move may need repeating. M3 practice progress is written online
  only (no outbox), so nothing of it is queued.
- GitHub keeps redirecting `akifadnan2003.github.io/speak-lab/<path>?query` to
  `speaklab.akiflabs.net/<path>?query`, so an emailed `token_hash` link to the old address still
  arrives at the app with its query intact and is consumed by `captureAuthRedirect()`.

## 4. Production verification checklist (after merge + deploy)

- [ ] `https://speaklab.akiflabs.net/` loads over HTTPS, title "SpeakLab", no mixed content.
- [ ] `https://speaklab.akiflabs.net/manifest.webmanifest` has `start_url`, `scope`, `id` = `/`.
- [ ] `https://speaklab.akiflabs.net/sw.js` exists; DevTools → Application shows one service
      worker with scope `https://speaklab.akiflabs.net/`.
- [ ] `https://akifadnan2003.github.io/speak-lab/#/login` redirects to the custom domain.
- [ ] Deep link + refresh: `https://speaklab.akiflabs.net/#/learn/a0-01` (signed in).
- [ ] Tutor signs in, sees My Students; student signs in, sees the dashboard; `/tutor` as a
      student bounces to the dashboard.
- [ ] Session survives a reload and a 10-minute wait (refresh token).
- [ ] Sign out returns to `/#/login` and leaves only `speaklab.theme` in storage.
- [ ] Disable a test student from the tutor dashboard: their live session is blocked.
- [ ] Invite (needs custom SMTP) or create a student in the dashboard and link them; the welcome
      flow completes at the new origin.
- [ ] Forgot password: do not claim it works until SMTP is configured and the link was opened.
- [ ] Chapter check / vocabulary review round-trip as in the M4 verification.
- [ ] Mobile: 320 px wide without horizontal overflow; install prompt offered from the new origin.

## 5. Rollback

1. Revert the merge commit of the migration PR on `main` (restores `base: /speak-lab/` and the
   old lists) and let Pages deploy, **and** remove the custom domain in the repository's Pages
   settings so GitHub serves the project site again. Until the domain is removed, GitHub keeps
   redirecting the old URL to the custom domain.
2. Set the Supabase Site URL back to `https://akifadnan2003.github.io/speak-lab/` (the old URL is
   still on the Redirect URLs list during the migration, so nothing else changes).
3. Re-run the backend workflow so `SPEAKLAB_ALLOWED_APP_URLS` matches (both URLs are on the list
   in either direction, so this is not urgent).
4. No database action is involved in either direction.
