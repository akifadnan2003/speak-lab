# Vocabulary persistence (M4 integration preparation)

Status: **prepared on branch `m4-integration-prep`, not merged, not deployed.** Nothing here has
been applied to the hosted Supabase project. This document is the design, the security model, the
evidence, and the integration handoff for moving M4 vocabulary progress from the device into the
student's account.

Provisional decision record: the ADR below is numbered `ADR-M4P` on purpose. `docs/DECISIONS.md`
on `main` (M2) and on the M3/M4 branches both use ADR-009 to ADR-011 for different decisions; the
M3 integration renumbers them. When this work is integrated, give `ADR-M4P` the next free number
and move it into `docs/DECISIONS.md`.

---

## 1. Integration contracts reviewed (Task 1)

| Contract | Where (on `main`) | What vocabulary relies on |
| --- | --- | --- |
| Student identity | `auth.uid()` in Postgres; `useCurrentUser()` / `AuthProvider` in the app | The database takes the student from the verified JWT. The client's user id is used only to *refuse* mismatched calls, never to authorize. |
| Supabase client | `src/lib/supabase/client.ts` `getSupabaseClient()` | Returns `null` when Supabase is not configured (preview, tests) → vocabulary stays on the device. `detectSessionInUrl` stays off; session key `speaklab.auth`. |
| Roles and status | `profiles.role` / `profiles.status` (server-managed), `public.is_active()`, `public.is_tutor()` | Reused unchanged in the new policies and functions. Only `role = 'student'` and `status = 'active'` can record reviews. |
| Tutor ↔ student | `public.tutor_students` (one tutor per student) | Tutor policies join through it, exactly like M2's `profiles` policy. |
| Migration conventions | `supabase/migrations/<timestamp>_<name>.sql`, applied only by the manual `supabase-deploy.yml` | Two additive migrations; explicit `revoke`/`grant`; `security definer` + `set search_path = ''`; no dashboard changes. |
| RLS conventions | `(select auth.uid())`, `is_active()` on every student policy, tutor via `is_tutor()` + link | Same patterns, same naming style (`"table: who does what"`). |
| Progress ports | `src/features/curriculum/ports.ts` (`ProgressRepository`), `src/features/vocabulary/ports.ts` (`VocabularyRepository`) | Ports unchanged. The cloud implementation plugs into `VocabularyProvider`; screens and scheduler did not change. |
| Sign-out / account switch | `src/lib/local-data.ts`: `clearLocalStudentData()`, `activateLocalUser()`, `registerLocalDataCleaner()`; `AuthProvider` also calls `queryClient.clear()` | Vocabulary keys use the `speaklab.` prefix; a cleaner registered from `VocabularyProvider` drops in-memory caches, queues and timers. No auth file edited. |
| Authorization in the UI | `RequireRole` guards in `src/features/auth/guards.tsx`, `/vocabulary` under `role="student"` | UI guards are convenience only; the database enforces everything. |
| Chapter ↔ vocabulary | `VocabularyEntry.chapterIds` (bank) → curriculum chapter ids (`a0-01`, …); queue gets `currentChapterIds` from `useProgression()` | Mirrored server-side as `vocabulary_items.chapter_ids text[]` (GIN index). Lesson `vocabulary` blocks in M3 are inline items, not bank references. |

## 2. Data model

`supabase/migrations/20261111150000_vocabulary_persistence.sql` (schema, functions, RLS) and
`20261111150100_vocabulary_bank_v1.sql` (generated bank mirror).

| Table | Purpose | Client access |
| --- | --- | --- |
| `vocabulary_items` | Bank mirror: `entry_id`, term, level, topics, `chapter_ids`, `bank_version`, `retired_at`. Text content stays in the app bundle. | SELECT (active users) |
| `student_vocabulary` | One row per student × word: stage, ease, interval, repetitions, recall streak, **lapses**, due/last/first instants, recognition and recall counters, **spoken-use count**, review count, last review id. | SELECT (own / tutor's linked) |
| `vocabulary_reviews` | Every answer: client idempotency id (PK), mode, skill, correct, server-derived quality, hint, flashcard self-grade, answer text, `reviewed_at` (learner), `received_at` (server), `source` (`live`/`import`), `applied`, state after, `voided_at`. | SELECT (own / tutor's linked) |
| `vocabulary_student_meta` | Reset watermark (`reset_at`, `reset_count`). | SELECT (own / tutor's linked) |

Recognition history, active-recall performance, spoken use, lapses, mastery (`stage = 'mastered'`)
and the full review timeline are all derivable per student and per word from these tables.

**Bank versioning.** `vocabulary_items` is filled by a generated migration.
`src/features/vocabulary/content/bank-seed.test.ts` fails when `bank.ts` and the newest seed differ.
To change the bank: bump `VOCABULARY_BANK_SEED` (version + new timestamped file name) and run
`npx vitest run src/features/vocabulary/content/bank-seed.test.ts -u`. Never edit an applied seed;
words removed from the bank are retired, not deleted, because reviews reference them.

## 3. Write path and security model (`ADR-M4P`)

**Decision.** The server owns the spaced-repetition schedule. Clients have SELECT only on every
vocabulary table. There are exactly two write functions, both `security definer`, both taking the
student from `auth.uid()` and both refusing anyone who is not an active student:

- `record_vocabulary_reviews(p_expected_student uuid, p_reviews jsonb, p_source text)`: validates
  each review (id format, known word, known mode, mode ↔ skill, boolean `correct`, self-grade only for
  flashcards, time not in the future and not before the account existed), **derives quality from
  the mode and answer flags**, and runs `public.vocabulary_schedule()` (a line-for-line port of
  `schedule()`), then returns the server's states. Client-sent quality, interval, stage, ease or
  student id are ignored.
- `reset_vocabulary_progress(p_expected_student uuid)`: deletes the schedule, voids (keeps) history
  for the tutor, moves the reset watermark.

`p_expected_student` is the account a review queue was written under. It never grants anything;
it can only make the call fail, so a queue written under student A cannot be flushed into student
B's account if the session changes underneath a pending request.

**Why not upsert states from the browser?** Mastery and the schedule would then be whatever the
browser sends. With this design a client can only submit answers; the schedule follows from them.

**Honest limit.** `correct` is still decided in the browser, because vocabulary practice is graded
there. A modified client could submit "correct" answers it did not earn. That is acceptable for
formative self-practice, and the tutor sees every answer with server receive times. **Vocabulary
progress is not an official assessment** and must not feed one without server-side grading (M3's
assessment-integrity follow-up applies here too).

**Data API exposure.** New tables are not assumed to be exposed or protected by defaults: every
table and function has explicit `revoke … from public, anon, authenticated` and the minimal
`grant`. The PGlite harness deliberately recreates Supabase's most permissive default privileges,
so a forgotten revoke fails the tests (verified by deleting the revokes: three tests failed).

## 4. Ordering and conflict rules

Applied identically to live practice, offline queues, a second device and the local import:

1. **Idempotency.** The review id is the primary key. A replayed id returns `duplicate` and changes
   nothing. An id owned by another student returns `rejected/id_conflict` and reveals nothing.
2. **Chronological replay.** A batch is applied in `reviewed_at` order, whatever the array order.
3. **Never rewind.** A review at or before the word's `last_reviewed_at` is stored as history
   (`applied = false`, `recorded/older_than_state`). Newer server progress is never overwritten by an
   older answer.
4. **Reset wins.** A review at or before the last reset is stored voided (`before_reset`), so a stale
   queue on another device cannot resurrect reset progress.
5. **Clock sanity.** `reviewed_at` may be at most 5 minutes in the future (then clamped to the server
   clock) and not before the account was created.
6. **Serialization.** Each word's row is created if needed and locked (`select … for update`) before
   the idempotency check, so concurrent submissions of the same review apply once.
7. **Time.** Instants are UTC; intervals are whole 24-hour days (`interval '24 hours'`), so due times
   do not depend on the database session time zone or DST. "Due today" / "overdue" are computed in
   the learner's own time zone on the device (`dateKey`), as in M4.

## 5. Client: authenticated repository

`src/features/vocabulary/persistence/`:

- `api.ts`: the `VocabularyApi` port and its only network implementation (supabase-js). It pages past
  PostgREST's 1000-row limit and classifies errors: offline, timeout, 429, 5xx and expired JWT are
  *transient*; account mismatch and malformed requests are *permanent*.
- `outbox.ts`: durable per-account queue `speaklab.vocab.outbox.v1:<uid>`. Storage is the single
  source of truth (memory only if storage refuses writes), so a storage purge empties it.
- `cloud.ts`: `VocabularyRepository` + `flush()`, `pendingCount()`, `listDueStates()`, `dispose()`.
  - Every call checks the requested student against the current session (`VocabularyAccountMismatchError`).
  - `upsertState` only stores an optimistic preview; `recordReview` queues, then sends.
  - Network failure is not a save failure: the answer stays queued and is retried with backoff,
    on the `online` event and on the next read.
  - Reads overlay queued answers on the server copy; during a transient outage they fall back to
    the last server copy. With no copy at all they fail rather than show empty progress.
  - Signing in on another device restores everything from the server (nothing local needed).
- `wire.ts`: row ↔ state mapping (instants normalised to UTC) and the review payload (no quality,
  interval or stage; flashcard self-grade derived from the recorded quality).
- `VocabularyProvider` picks this repository when `getSupabaseClient()` is non-null; otherwise the
  M4 device repository (preview mode, tests).

## 6. Local-to-cloud migration (Task 5)

`src/features/vocabulary/cloud-import.ts` + `components/LocalImportCard.tsx`:

1. Shown only in cloud mode when this device holds records for the **signed-in** account.
2. The learner sees a plan first: words to add, words that get newer answers, words whose account
   progress is newer and stay as they are, and words that cannot be uploaded (history trimmed).
3. Upload only on "Upload to my account" (`run(plan, { consent: true })`). "Not now" changes nothing;
   "Delete from this device" asks for a second confirmation.
4. Refused outright: preview (`preview-*`) records, records of another account, snapshots that mix
   accounts. Records are never re-keyed.
5. Local *states* are never uploaded. Local *reviews* are replayed through the same server function
   (`source = 'import'`), so rules 1 to 7 above apply. The device copy is deleted only after every
   batch was answered; a failure leaves it intact and re-running is safe.

## 7. Account cleanup contract (Task 6)

- All vocabulary device data uses `speaklab.vocab.*` keys, so M2's `clearLocalStudentData()` removes
  it on sign-out, on `SIGNED_OUT`, and when `activateLocalUser()` sees a different account.
- `persistence/cleanup.ts` registers `clearVocabularyDeviceData()` with
  `registerLocalDataCleaner()` (once, from `VocabularyProvider`) to drop what storage purging cannot
  reach: in-memory caches, optimistic states and retry timers of live repositories.
- M2's `AuthProvider` already calls `queryClient.clear()` on sign-out and account switch; vocabulary
  query keys are `['student', <id>, …]`.
- **Known trade-off:** answers still queued *offline* at sign-out are discarded with the rest of the
  device data (correct for shared devices). Optional follow-up for the auth owner: before
  `clearLocalStudentData()` in `signOut()`, await a best-effort flush of the cloud repository with a
  short timeout. Not done here because it edits an auth file.

## 8. Evidence

| What | Where | Proof level | Ran here |
| --- | --- | --- | --- |
| Grants, RLS, review/reset functions, isolation, tutor read, disabled accounts, idempotency, ordering, reset, validation (22 tests) | `supabase/tests/pglite/vocabulary-rls.test.ts` | Real Postgres 17 (PGlite), real migrations, `anon`/`authenticated`/`service_role` + JWT claims | ✅ `npm run test:db:pglite` |
| TS scheduler ≡ SQL scheduler (40 seeded sequences, mastery, lapses, hard cap, 5 time zones, DST) | `src/features/vocabulary/srs/scheduler.sql-parity.test.ts` | Real Postgres via PGlite; mutation-checked | ✅ `npm run test` |
| Bank seed matches `bank.ts` | `content/bank-seed.test.ts` | File snapshot | ✅ |
| Sync, offline queue, retry, cross-device restore, account-switch race, conflicts, reset, import, consent UI, cleanup through M2's real `clearLocalStudentData()` | `persistence/*.test.ts`, `cloud-import.test.ts`, `components/LocalImportCard.test.tsx` | Unit/integration with an in-memory **model** of the server. Not security evidence. | ✅ |
| GoTrue JWTs through PostgREST, Data API exposure, concurrent duplicate submissions | `supabase/tests/vocabulary-rls.test.ts` | Full local Supabase stack | ❌ **Not executed** (no Docker on this machine; `ci.yml` runs it only on pull requests and pushes to `main`) |

PGlite does not run GoTrue, PostgREST or concurrent connections; that is what the stack test is for.

## 9. Handoff: integrating onto the M3 foundation (Task 8)

Branch layout (`git log --oneline --first-parent m4-integration-prep`):

```
<docs/tests>  Document vocabulary persistence and add the full-stack test
2cb418d       Client repository, offline queue, consented import, cleanup
77c6233       Schema, review RPC, RLS, bank seed (+ PGlite tests)
7ea0a83       Add PGlite devDependency + test:db:pglite script
9bf65d7       SCAFFOLDING merge of main (M2) — do not carry forward
b25f50d       M4 standalone (worktree-m4-vocabulary)
```

`9bf65d7` contains *my* resolution of M3-vs-M2 conflicts (router, docs). It competes with the M3
integration and must not reach `main`. Only the commits after it are the deliverable.

### Procedure (after the M3 integration branch is final; call it `INTEGRATED`)

```bash
# 1. Bring M4 itself onto the integrated foundation (same touch points as before).
git switch -c m4-integration INTEGRATED
git merge --no-ff worktree-m4-vocabulary
#    Expected conflicts (dry run on ce856c9): src/app/router.tsx (add the one route
#    /vocabulary/practice/:modeId next to /vocabulary inside RequireRole student) and
#    docs/ROADMAP.md (keep both). Renumber M4's "ADR-011 · Vocabulary…" to the next free ADR.
npm ci && npm run check

# 2. Replay only the preparation commits, skipping the scaffolding merge.
git cherry-pick 9bf65d7..m4-integration-prep
#    If package-lock.json conflicts: take INTEGRATED's lockfile, then
#    `npm i -D -E @electric-sql/pglite@0.3.16` and `git add package.json package-lock.json`.
npm ci && npm run check && npm run test:db:pglite && npx playwright test

# 3. Open a PR into main (do not merge without the owner). The CI database job then runs
#    supabase/tests/vocabulary-rls.test.ts against the full stack for the first time.
```

The result of steps 1 and 2 against Agent 1's in-progress `ce856c9` is recorded in the commit that
adds this document.

### Potential conflicts and dependencies

- `src/app/router.tsx`, `docs/ROADMAP.md`: from M4 itself (step 1).
- ADR numbers: M2 (main) and M3/M4 both used ADR-009…011. Renumber during integration.
- `package.json` / `package-lock.json`: the PGlite devDependency and the `test:db:pglite` script (own commit).
- `src/lib/local-data.ts`: `cleanup.ts` depends on `registerLocalDataCleaner()` as it is on `main`.
  If the integration renames it, update one import.
- `src/features/curriculum/CurriculumProvider.tsx` `useProgression()`: used by the vocabulary
  dashboard for current chapters (unchanged by this work).
- Migration order: `20261111150000` and `20261111150100` depend only on M2's migration. If the M3
  integration adds curriculum tables with an *earlier* timestamp, order is still fine; nothing here
  references curriculum tables.
- No table, type or function names overlap with M2; the names are reserved for vocabulary
  (`vocabulary_*`, `student_vocabulary`). The M3 integration must not create its own vocabulary tables.

### Follow-up (not done here)

1. Run the CI `database` job on a PR (first real-stack execution of `supabase/tests/vocabulary-rls.test.ts`).
2. Deploying: after merge, the owner runs `supabase-deploy.yml` (migrations). Never from the dashboard.
3. If M3 integration adds a `curriculum_chapters` table: add an FK or a validation trigger for
   `vocabulary_items.chapter_ids`.
4. Optional best-effort flush before sign-out (auth owner, see §7).
5. Tutor UI (M6): read `student_vocabulary` / `vocabulary_reviews` for linked students; the
   policies are already in place.
6. Move `persistence/wire.ts` row types into `src/lib/supabase/database.types.ts` once that file is
   free of concurrent edits.
7. A UI indicator for queued answers (`pendingCount`) and refetch after a background retry.
8. Rate limiting or server-side grading if vocabulary ever counts towards an assessment.
