# M4 design — Vocabulary and intelligent revision (frontend-independent slice)

Date: 2026-11-03. Author: Agent 2 on branch `worktree-m3-curriculum`, on top of M3. Status: implemented.

## Intent

A real vocabulary system: a validated A0–A2 word bank, an explainable spaced-repetition scheduler,
six working practice modes, a dashboard computed from stored records, and a deterministic revision
queue. Persistence stays behind a port so the Supabase repository can replace localStorage later.

## Goals / non-goals

Goals: everything in the M4 brief that does not need audio, speech or a backend.
Non-goals: audio playback (no audio assets exist; the schema has the field and the UI shows a
button only when a URL is present), listening and speaking modes (interfaces defined, modes listed
as unavailable with the reason), AI evaluation, tutor-side vocabulary management.

## Decisions

1. **Schema** (`src/features/vocabulary/schema.ts`). `VocabularyEntrySchema`: id, term, kind
   (`word | expression`), partOfSpeech, definition (EN), examples (≥1), `translations` keyed by
   support language (`az` today; the key set is `SUPPORT_LANGUAGES`, nothing is mandatory),
   pronunciation `{ respelling?, ipa?, audioUrl? }`, synonyms, antonyms, collocations, wordFamily,
   grammarNote (`LocalizedText`), level, topics (fixed enum of 13 categories), tags, `chapterIds`
   (links to curriculum chapters for "current lesson" prioritisation). Bank-level validation rejects
   duplicate ids and duplicate (term, partOfSpeech).
2. **Scheduler** (`srs/scheduler.ts`): SM-2 adapted, fully deterministic, pure.
   - Stages: `new → learning → review → mastered`; a lapse from `review`/`mastered` goes back to
     `learning` with the `lapses` counter incremented (so "previously mastered, needs reinforcement"
     is visible).
   - Learning steps: first correct answer → due in 1 day; second → 3 days; then SM-2 intervals
     (`6`, then `interval × ease`). Ease starts 2.5, bounded [1.3, 3.0], updated with the SM-2
     formula from a quality 0–5. Incorrect → quality ≤ 2, interval 1 day, repetitions reset.
   - Quality from an answer: recall correct without hint 5, with hint 4, recognition correct 4,
     flashcard self-grade maps Again/Hard/Good/Easy → 1/3/4/5, incorrect 1.
   - Mastered when the interval reaches 21 days with at least 3 consecutive correct recall-type
     answers; mastered items keep scheduling (longer intervals) and are reinforced when due.
   - Recognition, active recall and spoken use are tracked as separate counters on the state.
   - Due is an ISO instant; "due" means `dueAt <= now`. Day boundaries (streaks, "today") use
     the learner's time zone through `Intl.DateTimeFormat`, injectable in tests.
   - No claims of optimality; the algorithm is documented as SM-2-style and explainable.
3. **Revision queue** (`revision/queue.ts`): pure, deterministic. Buckets in priority order:
   overdue (most overdue first), recently incorrect (last 7 days), weak recall (recall accuracy
   < 70 % with ≥ 3 recall attempts), current-chapter words not yet mastered (new ones included),
   mastered-but-due reinforcement, then other due, then new words to introduce (capped per
   session). Ties break by id. No randomness.
4. **Modes** (`modes/`): a `VocabularyMode` registry. Four modes build `Exercise` objects from the
   M3 schema and render through `ExerciseRenderer` (multiple-choice meaning, matching,
   fill-the-blank in an example, sentence completion as multiple choice). Flashcards and active
   recall are dedicated components. Listening and speaking modes are registered with
   `available: false` and shown disabled with the reason. Distractors come from the bank by
   seeded shuffle keyed on the item id.
5. **Ports** (`ports.ts`): `VocabularyBankSource` and `VocabularyRepository` (states, reviews,
   clear). Memory + localStorage implementations namespaced per student id
   (`speaklab.vocab.v1:<studentId>`). `clearStoredVocabulary()` for sign-out. `migration.ts`
   exports a snapshot of one student's local records for an explicit, user-confirmed upload later;
   nothing merges automatically and preview ids are refused.
6. **Routes**: `/vocabulary` (dashboard with tabs) and `/vocabulary/practice/:modeId`.
7. **UX**: English first. Translations and grammar notes are hidden behind a reveal in practice
   and the Azerbaijani switch in the list, reusing `AzHelpProvider`.

## Left to later

Supabase repository and migrations, audio assets and listening mode (M7/M8), tutor vocabulary
assignment, SM-2 parameter tuning from real data.
