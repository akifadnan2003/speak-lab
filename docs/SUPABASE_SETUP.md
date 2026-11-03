# SpeakLab — Supabase setup and operations guide

Last updated for milestone M2 (2026-11-03). Everything here is done by the owner in trusted
environments (Supabase dashboard, GitHub Actions). Nothing in this guide is ever pasted into a
tracked file.

Project in use: `https://bpxklwlotpqnfonpnjuc.supabase.co` (dedicated SpeakLab project).

## 1. One-time project configuration (dashboard)

### 1.1 Authentication → Sign In / Providers

| Setting | Value | Why |
| --- | --- | --- |
| Allow new users to sign up | **Off** | Invitation-only. Verified: `/auth/v1/signup` returns `signup_disabled`. |
| Allow anonymous sign-ins | **Off** | No anonymous sessions. |
| Email provider | **On** | Students sign in with email + password. |
| Confirm email | On (default) | Invitations are confirmed through the emailed link. |
| Minimum password length | **10** | Matches the client validation (`src/features/auth/password.ts`). |
| Password requirements | **Letters and digits** | Same. |
| Secure password change | Off (default) | A verified recovery link must be able to set a new password. |

### 1.2 Authentication → URL Configuration

| Setting | Value |
| --- | --- |
| Site URL | `https://akifadnan2003.github.io/speak-lab/` |
| Redirect URLs | `https://akifadnan2003.github.io/speak-lab/`, `http://localhost:5173/speak-lab/`, `http://localhost:4173/speak-lab/` |

The app passes the exact app URL as `redirectTo`; Supabase only honours URLs on this list.

### 1.3 Authentication → Email Templates (required)

SpeakLab links go **directly to the app** with a `token_hash`, not through the Supabase
`/auth/v1/verify` redirect. This is what makes invitation and recovery links reliable on GitHub
Pages with hash routing on every browser (see ADR-009). Replace the two templates with the files
in `supabase/templates/`:

- **Invite user** → subject `You are invited to SpeakLab`, body = `supabase/templates/invite.html`
- **Reset password** → subject `Reset your SpeakLab password`, body = `supabase/templates/recovery.html`

The essential line in each template is the link:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite">Accept invitation</a>
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a>
```

If the templates are left at the defaults, invitation links arrive as implicit-grant tokens in
the URL fragment. The app **rejects** that format on purpose (it would let anyone craft a link
that signs a victim into a foreign session) and shows "This link format is not accepted".
Customising the two templates is therefore mandatory.

### 1.4 Authentication → Settings

| Setting | Recommended | Note |
| --- | --- | --- |
| Email OTP expiration | 3600 s (1 h) | Must match the `SPEAKLAB_INVITE_TTL_SECONDS` function secret so the tutor UI shows the right expiry. |
| JWT expiry (access token) | 600–3600 s | A disabled student is blocked by RLS immediately and cannot refresh; a shorter JWT expiry shortens the window in which an already-issued token could still *authenticate* (it can no longer read data). |

### 1.5 API keys

- Repository **variables**: `VITE_SUPABASE_URL` = project URL, `VITE_SUPABASE_ANON_KEY` = the
  **publishable** key (`sb_publishable_…`). Both are already set.
- Repository **secrets**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`
  (already set) and `SUPABASE_DB_URL`: the **Session pooler** connection string from
  *Dashboard → Connect → Session pooler* with the password filled in
  (`postgresql://postgres.<ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres`).
  GitHub runners are IPv4-only and the direct database endpoint is IPv6, so migrations go
  through the pooler. Used only by the manual backend workflow, never by the frontend build.
- Never create a repository variable or `.env` entry with `sb_secret_…` or the legacy
  `service_role` key. The deploy workflow fails if the public key starts with `sb_secret_`.

## 2. Deploying the backend (migrations + Edge Function)

Backend changes are never applied by a frontend push. Use the manual workflow:

1. GitHub → Actions → **Supabase backend (manual)** → *Run workflow* (or
   `gh workflow run supabase-deploy.yml`).
2. Leave *migrations* and *functions* ticked. Tick *dry run* first if you want to see the plan.
3. The job validates that `SUPABASE_DB_URL` is the Session pooler string for the linked project
   (without printing it), links the project, prints `supabase migration list --remote=<pooler url>`,
   runs `supabase db push --remote=<pooler url>` (additive: only migrations the project has not
   applied yet; CLI 3.x targets the local stack unless `--remote` is given), deploys the
   `student-admin` function with `--no-verify-jwt` (the function verifies callers itself), and
   sets the function secrets `SPEAKLAB_ALLOWED_APP_URLS` and `SPEAKLAB_INVITE_TTL_SECONDS`.

Migrations are plain SQL under `supabase/migrations/` and are the only way schema and policies
change. Do not edit tables or policies in the dashboard.

## 3. Owner bootstrap (exactly one tutor)

The tutor role is granted by a database function that only the service role / SQL editor can
run, keyed on the **verified Auth user id**. No endpoint in the app can grant it.

1. Dashboard → Authentication → Users → **Add user** → *Create new user*. Enter your email and a
   strong password and tick **Auto confirm user**. (Alternatively *Invite user*: you then set your
   password through the emailed link, which also confirms the address.)
2. Open the new user and copy its **User UID** (a UUID). The address bar also shows it.
3. Dashboard → SQL Editor → run, replacing the UUID:

   ```sql
   select public.bootstrap_owner('00000000-0000-0000-0000-000000000000');
   ```

   Result `bootstrapped` on first run, `already-owner` on repetition. It fails with a clear
   message if the user does not exist, is not confirmed, or if a different tutor already exists.
   A partial unique index (`profiles_single_tutor_idx`) makes a second tutor impossible even for
   the service role. The event is recorded in `account_events` (`owner_bootstrapped`).
4. Sign in at `https://akifadnan2003.github.io/speak-lab/` with that email and password. You land
   on **My Students**.

Students are never bootstrapped; they only exist through invitations.

## 4. Invitation behaviour

- The tutor invites by email + name. The `student-admin` Edge Function verifies the caller's
  session with the Auth server, checks `profiles.role = 'tutor'` and `status = 'active'`, then
  calls `auth.admin.inviteUserByEmail` with the service key (server-side only).
- Supabase sends the **Invite user** email. The link opens the app at
  `https://akifadnan2003.github.io/speak-lab/?token_hash=…&type=invite`. The app verifies the
  token, creates the session, scrubs the token from the address bar, and takes the student to
  `/welcome` to choose a password and preferences.
- Acceptance is recorded by database triggers (profile `invited → active`, invitation `accepted`,
  `tutor_students` link, `account_events`). The client is not trusted for any of it.
- Links work once and expire after the OTP expiration. An expired or reused link shows an
  explanation and the tutor can **Resend** (new link, same email, counter incremented).
- **Revoke** deletes the unconfirmed Auth user and marks the invitation `revoked`; the emailed
  link stops working. Accepted invitations cannot be revoked: use **Disable account** instead.
- Duplicate pending invitations and invitations for existing accounts are refused with a message.

## 5. Disabling and reactivating students

**Disable account** on a student profile sets `profiles.status = 'disabled'` **and** bans the Auth
user (`ban_duration`). Effects, all server-side:

- Every RLS policy except "read your own profile row" denies the user immediately, even with a
  live session.
- Refresh tokens are refused, so the session cannot be renewed; sign-in returns *user banned*.
- The app shows **Account disabled** on the next profile check (≤ 60 s or on reload).

**Reactivate** reverses both. Both actions are logged in `account_events`.

## 6. Local development and tests

```bash
npx supabase start                 # Postgres, Auth, Edge Functions, Mailpit (needs Docker)
npx supabase status                # prints local URL and keys
npm run test:db                    # authorization / lifecycle tests against the local stack
npm run test:e2e:auth              # real invite / recovery / disable flows in the browser
npx supabase db reset              # re-apply migrations from scratch
```

Local emails are captured by Mailpit at `http://127.0.0.1:54324`. `supabase/config.toml`
mirrors the production auth settings (signup off, password policy, templates, redirect URLs).

For `npm run dev` against the local stack put the values from `supabase status` into
`.env.local` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

## 7. Rollback procedures

| Situation | Action |
| --- | --- |
| Bad frontend release | Re-run **Deploy to GitHub Pages** from the previous good commit (`gh workflow run deploy.yml --ref <sha>`), or revert the commit on `main`. The backend is unaffected. |
| Edge Function regression | `supabase functions deploy student-admin --no-verify-jwt` from the previous commit (or re-run the manual workflow on that commit). The function is stateless. |
| Migration problem | Migrations are forward-only. Write a new migration that reverses the change (`supabase migration new revert_x`), run it through the manual workflow. Never `db reset` a hosted project. |
| Leaked publishable key | Harmless by design (RLS), but rotate it in the dashboard and update the repository variable. |
| Leaked secret / service key | Rotate immediately in the dashboard (API keys). Edge Function secrets are injected by the platform and pick up the new key automatically. |
| Owner locked out | Use *Reset password* in the app, or set a new password from the dashboard user page. The role is in `profiles`, independent of the password. |
| Wrong user bootstrapped as owner | SQL editor: `update public.profiles set role = 'student' where id = '<uuid>';` then run `bootstrap_owner` for the correct id. Review `account_events`. |

## 8. Checklist before inviting the first students

- [ ] Sign-ups off, anonymous off (verified by `GET /auth/v1/settings`: `disable_signup: true`).
- [ ] Redirect URLs include the GitHub Pages URL.
- [ ] Invite and Reset-password templates replaced (section 1.3).
- [ ] Manual backend workflow run successfully (migration applied, function deployed).
- [ ] Owner user created and `bootstrap_owner` returned `bootstrapped`.
- [ ] Owner can sign in on the live site and sees **My Students** with zero students.
- [ ] Send yourself a test invitation to a second email address and complete the flow on a phone.
