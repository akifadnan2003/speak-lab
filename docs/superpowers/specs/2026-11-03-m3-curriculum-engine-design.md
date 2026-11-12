# M3 design — Curriculum and interactive exercise engine (frontend-independent slice)

Date: 2026-11-03. Author: Agent 2 (M3) on branch `worktree-m3-curriculum`. Status: implemented.

## Intent

Give SpeakLab a real, typed, versioned curriculum and an exercise engine that works today without a
backend, so the Learn → Chapter → Lesson flow stops being a demo shell. Persistence is behind an
interface so M2's Supabase work can plug in without touching content or components.

## Goals

- Complete prerequisite-ordered curriculum map A0 → C1 (70 chapters) with objectives, skills and
  prerequisite links, validated by Zod at module load.
- Strongly typed lesson/exercise schemas (Zod, discriminated unions) shared by content and renderer.
- Exercise engine: multiple choice, fill-in-the-blank, sentence ordering, error correction,
  matching, question formation, sentence transformation, speaking prompt (self-checked), guided
  writing (deterministic checklist). Deterministic grading, explanations (EN, optional AZ), hints,
  retries, keyboard + touch accessible, 320px-safe.
- Chapter A0-01 fully authored: sentence structure, subject pronouns, am/is/are, negatives,
  questions, greetings vocabulary, pronunciation (alphabet), extensive speaking drills, reading,
  writing, chapter assessment.
- Chapter completion and assessment logic (lesson status machine, unlock from prerequisites,
  tutor overrides modelled, pass threshold ≥ 80 % for assessments).
- Unit + component tests. No fake AI, no fake buttons.

## Non-goals / anti-goals

- No Supabase tables, migrations, Edge Functions, auth or deploy changes (Agent 1 owns M2).
- No audio, speech recognition or AI evaluation. Speaking and writing are self-checked with
  honest labelling.
- No tutor content editor UI (M6).
- No placement assessment content (skeleton type only).

## Decisions

1. **A0 chapter 1 is "Sentence structure, pronouns and *to be*"** (brief requirement). The
   alphabet becomes a pronunciation lesson inside it ("Spell your name"); greetings and classroom
   language are its vocabulary lesson. `docs/CURRICULUM.md` updated accordingly.
2. **Content is TypeScript modules under `src/features/curriculum/content/`**, parsed through Zod
   at import (`parseChapter`). The same schemas will validate JSON stored in `lesson_content`
   later; the renderer never imports content modules directly, only the registry.
3. **`ContentSource` and `ProgressRepository` interfaces** (`src/features/curriculum/ports.ts`).
   Implementations shipped: static content source; in-memory and `localStorage` progress
   repositories keyed by student id. Supabase implementations are later backend work.
4. **Azerbaijani is a `LocalizedText { en, az? }` field** on explanations, hints and feedback. UI
   shows a toggle only when `az` exists. English stays primary.
5. **Lesson kinds** gain `pronunciation`. Exercise `type` union is the schema source of truth;
   adding a type means adding a schema, a grader and a component (exhaustive switch enforced).
6. **Grading is pure** (`grade(exercise, answer) → GradeResult`). Text answers are normalised
   (case, whitespace, trailing punctuation, curly quotes, apostrophes). Accepted answer lists are
   authored explicitly; no fuzzy matching.
7. **Practice lessons allow 3 attempts per exercise then reveal; assessments allow 1** and hide
   explanations until the end. Lesson completion: all exercises answered; assessment completion:
   score ≥ chapter `passMark`. Chapter completion: every required lesson completed + assessment
   passed. Speaking lessons count as completed when every prompt is marked done.
8. **Routes unchanged** (`/learn`, `/learn/:chapterId`, `/learn/:chapterId/lessons/:lessonId`);
   pages now read the registry and the progress repository instead of `src/demo/curriculum.ts`.
   Chapters without authored content are listed with an honest "not written yet" state and no
   links.

## Left to later milestones

Supabase `ProgressRepository`, tutor overrides UI, vocabulary SRS, listening audio, AI speaking.
