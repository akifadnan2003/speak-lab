# SpeakLab — Curriculum Specification

Last updated for milestone M3 (2026-11-03). The sequencing below is encoded as validated content in
`src/features/curriculum/content/curriculum-map.ts`; authored chapters live in
`src/features/curriculum/content/chapters/`. This document stays the human-readable source of truth
and must change together with the map (`curriculum.test.ts` checks counts and ordering).

## 1. Teaching philosophy

- **Speaking first.** Every chapter ends with spoken production; comprehension and production are
  tracked separately because the first learners understand far more than they can say.
- **No forced slow lane.** A placement assessment plus tutor overrides (unlock/skip) let strong
  learners start where they are. Prerequisites are still recorded so gaps can be revisited.
- **Spiral revision.** Weak topics resurface in later speaking drills, vocabulary contexts and
  timed revision rather than being left behind.
- **Explain the mechanism.** Azerbaijani explanations describe *why* ("doesn't" carries tense and
  negation for he/she/it), not just the translation.

## 2. Content model

Each **curriculum unit (chapter)** carries: level, chapter number, title, description, learning
objectives, prerequisites (chapter ids), grammar explanation blocks (English, optional Azerbaijani),
example sentences, vocabulary set(s), interactive exercises, speaking drills, listening activities,
reading, writing task, end-of-chapter assessment, revision requirements, difficulty, completion
conditions (e.g. assessment ≥ 80 % and speaking drill completed), version.

Each **lesson** inside a chapter has a kind (`grammar | vocabulary | pronunciation | speaking |
listening | reading | writing | assessment`), an estimated duration, content blocks and inline
exercises. Lesson status per student: `locked | available | in_progress | completed | skipped`.

Schemas (`src/features/curriculum/schema/`): `ChapterSchema` → `LessonSchema` → `ContentBlockSchema`
(heading, paragraph, examples, table, tip, vocabulary, dialogue, passage) and `ExerciseSchema`, a
discriminated union of nine types: `multiple_choice`, `fill_blank`, `sentence_ordering`,
`error_correction`, `matching`, `question_formation`, `sentence_transformation`, `speaking_prompt`
(self-checked), `guided_writing` (deterministic checklist). Every explanation, hint and feedback
is a `LocalizedText { en, az? }`: English always, Azerbaijani optional and shown only on request.

Content is authored as TypeScript modules today and will be stored as versioned JSON in Postgres
(`lesson_content.version`) later; the same Zod schemas validate both. Chapters are never hardcoded
in React components: screens read the `ContentSource` port and the `ProgressRepository` port
(`src/features/curriculum/ports.ts`).

**Progression rules.** A chapter unlocks when its prerequisites are completed or skipped (or the
tutor unlocked it). Inside an unlocked chapter every lesson is available except the chapter check,
which unlocks when all other lessons are done. A chapter is complete when every lesson is completed
or skipped, speaking lessons are actually completed, and the chapter check reaches the pass mark
(80 % by default). Practice exercises allow three attempts, then reveal the answer; the chapter
check allows one attempt per item and shows explanations only at the end.

## 3. Level map

Chapter ids are `<level>-<nn>` (`a0-01` … `c1-12`). Status: ✅ authored · ⏳ planned.

### A0 — Foundations (8 chapters)
1. ✅ Sentence structure, subject pronouns and *am / is / are* — includes greetings, countries, jobs,
   classroom language, the alphabet (spelling your name), two speaking lessons, reading, writing
   and the chapter check (11 lessons, 130+ exercises)
2. Articles *a / an*, singular nouns, *this / that*
3. Plurals, *these / those*, numbers, prices
4. Adjectives: describing people and things; colours, nationalities
5. Possessive adjectives and *'s*; family
6. *There is / there are*; prepositions of place; home
7. Wh- questions: *what, where, who, how old*; personal information
8. Review, survival dialogues (café, shop, directions) and A0 checkpoint

### A1 — Elementary (10 chapters)
1. Present Simple: routines, frequency adverbs, *do / does* questions and negatives
2. *Have / has got*; possessions; describing people
3. *Can / can't* for ability and permission; polite requests
4. Present Continuous: now vs usually; clothes and weather
5. Countable / uncountable; *some / any / much / many / a lot of*; food
6. Prepositions of time *in / on / at*; telling the time; appointments
7. Object pronouns; *like / love / hate + -ing*; free time
8. *Was / were*; Past Simple of *to be*; yesterday
9. Imperatives; *should* for simple advice; health
10. Chapter assessment: a day in your life (spoken monologue, 60 s)

### A2 — Pre-intermediate (12 chapters)
1. Past Simple regular verbs; time expressions
2. Past Simple irregular verbs (top 50); narrative sequencing
3. Past Simple questions and negatives; biographies
4. Comparatives and superlatives; opinions about places
5. *Going to* and *will*; plans vs predictions
6. Past Simple consolidation and storytelling (currently rendered in the demo)
7. Past Continuous; *when / while*; interrupted actions
8. Future forms: *will*, *going to*, Present Continuous for arrangements
9. Modals: *can / could / should / must / have to*; rules and advice
10. Gerunds and infinitives after common verbs; preferences
11. Conjunctions and adverbs of manner; connected storytelling
12. Assessment: tell a two-minute story with background and events

### B1 — Intermediate (14 chapters)
1. Present Perfect: experiences, *ever / never*
2. Present Perfect with *since / for / yet / already / just*
3. Present Perfect vs Past Simple
4. Present Perfect Continuous
5. First conditional and *when / unless / as soon as*
6. Second conditional; hypothetical advice
7. Passive voice (present and past)
8. Relative clauses (defining); describing people, places, things
9. Reported speech: statements
10. Reported speech: questions and requests
11. Phrasal verbs I (daily life, 40 items); separable vs inseparable
12. Used to / would; past habits
13. Quantifiers and articles revisited; generalisations
14. Assessment: opinion discussion and short written email

### B2 — Upper-intermediate (14 chapters)
1. Past Perfect and Past Perfect Continuous; narrative tenses together
2. Future Continuous and Future Perfect
3. Third and mixed conditionals; regret and criticism
4. Modals of deduction (present and past)
5. Passive with modals and reporting verbs (*is said to…*)
6. Non-defining relative clauses; reduced relatives
7. Inversion for emphasis (*Not only…, Rarely…*)
8. Advanced linking and cohesion; discourse structure
9. Collocations and dependent prepositions
10. Idioms and fixed expressions in conversation
11. Phrasal verbs II (work, relationships, 60 items)
12. Professional communication: meetings, emails, presentations
13. Debate techniques: argument, concession, rebuttal
14. Assessment: structured debate and formal letter

### C1 — Advanced (12 chapters)
1. Nuance in tense and aspect; subtle meaning shifts
2. Discourse markers and hedging in natural speech
3. Advanced syntax: cleft sentences, fronting, ellipsis
4. Subjunctive and formal structures
5. Argumentation and persuasive language
6. Presentation skills and signposting
7. Real-world listening: accents, speed, implicit meaning
8. Register: formal, neutral, informal; tone
9. Academic and professional writing
10. Contextual vocabulary: precision, connotation, word families
11. Extended fluency: monologues and interviews
12. Final assessment: presentation, interview and essay

## 4. Complete tense system coverage

Present Simple · Present Continuous · Present Perfect · Present Perfect Continuous · Past Simple ·
Past Continuous · Past Perfect · Past Perfect Continuous · Future with *will* · *going to* ·
Present Continuous for the future · Future Continuous · Future Perfect · Future Perfect Continuous
(C1, receptive) · *used to / would* · passive forms of each where natural · reported-speech shifts.

Each tense is taught in affirmative, negative and question forms with time expressions, contrasted
with its nearest neighbour, and recycled in a speaking drill within two chapters.

## 5. Pronunciation objectives by level

- A0–A1: alphabet sounds, *th* sounds, final *-s* and *-ed*, basic word stress.
- A2: sentence stress and weak forms (*can / can't*, *to*, *and*), contractions.
- B1: intonation in questions and lists, linking (*an apple*), schwa.
- B2: connected speech, emphasis and contrast, minimal pairs for Azerbaijani speakers (/w/ vs /v/,
  /θ/ vs /t/, /ŋ/, vowel length).
- C1: rhythm, pausing for effect, register-appropriate intonation.

## 6. Vocabulary progression

| Level | Target active words | Themes |
| --- | --- | --- |
| A0 | 300 | greetings, numbers, family, home, food basics |
| A1 | 700 | routines, free time, shopping, health, weather |
| A2 | 1 200 | travel, work, biography, feelings, technology |
| B1 | 2 000 | education, media, environment, relationships, phrasal verbs I |
| B2 | 3 200 | business, society, science, idioms, collocations |
| C1 | 4 500+ | abstract topics, precision vocabulary, academic lexis |

Each item: term, part of speech, definition, pronunciation, audio, examples, Azerbaijani
translation, collocations, word family, difficulty, topic, review schedule.

## 7. Placement and revision

- **Placement assessment:** 40 graded items across grammar and vocabulary plus one short spoken
  task reviewed by the tutor; proposes a starting level the tutor confirms or overrides.
- **Quick revision:** any completed chapter offers a five-minute timed revision set.
- **Intelligent revision:** topics with accuracy below 70 % over the last 20 attempts are flagged
  as weak, surfaced on the dashboard, and injected into speaking drills and vocabulary contexts.
