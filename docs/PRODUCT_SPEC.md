# SpeakLab — Product Specification

Status: living document. Last updated for milestone M1 (2026-11-03).

## 1. Vision

SpeakLab is a complete English academy, not a gamified word-matching app. It combines structured
education from A0 to C1, extensive grammar practice, speaking-first instruction with an AI coach,
vocabulary acquisition with spaced repetition, listening/reading/writing/pronunciation work,
intelligent revision, individual progress tracking, and an exclusive Tutor Dashboard owned by the
application owner. Optional Azerbaijani explanations support the first learners.

Initial users: one tutor (the owner) and two Azerbaijani students who understand spoken English
well but need far more speaking fluency. The architecture never hardcodes a student limit.

## 2. Non-negotiable requirements

1. Only invited users can register; there is no public self-registration anywhere (UI or API).
2. Only the owner holds the Tutor/Admin role. Students cannot invite users or change roles.
3. The owner can invite, disable, reactivate and manage students.
4. Every student has a private account and history; students cannot see other students.
5. The owner inspects each student's detailed progress via clickable student cards.
6. English is the teaching language; Azerbaijani assistance is on demand.
7. Excellent experience on Windows laptops, iPhones and Android phones; installable PWA.
8. GitHub Pages hosts the static frontend; sensitive operations run in a secure backend.
9. No service-role credentials or AI API keys in the frontend.
10. Important data persists across sessions and devices.
11. Real functionality only; no decorative or nonfunctional UI.
12. Clean, premium, fast, accessible, consistent UI.
13. Milestone-by-milestone development with testing before continuing.

## 3. Roles

### Tutor / Administrator (owner only)
View all students; invite and manage accounts; open individual profiles; monitor progress,
curriculum state, grammar, vocabulary, speaking summaries, mistakes; assign homework; unlock or skip
chapters; leave feedback and private notes; see time spent and activity history; configure AI
learning settings; manage curriculum and learning paths; view AI usage and cost.

### Student
Own dashboard; lessons; grammar, vocabulary, listening, reading, writing practice; AI speaking;
mistake review; progress; assignments; preferences; Azerbaijani explanations; achievements and
history. No access to other students or admin tools.

## 4. Student experience

**Navigation:** Home · Learn · Speak · Vocabulary · Progress · Settings (profile).
Mobile: five-item bottom bar (Home, Learn, Speak, Vocab, Progress); Settings through the account
menu and drawer. Desktop: full sidebar.

**Home (dashboard):** personalised greeting, current level, today's recommended lesson with
Continue button, course progress, recent activity, daily speaking target, vocabulary due, pending
assignments, weak grammar topics, recent achievements, quick AI conversation access, weekly activity.

**Learn:** level overview (A0–C1), chapter list with status (locked / available / in progress /
completed), chapter page with objectives and lessons, lesson workspace with explanation panel,
exercise panel, Azerbaijani explanation action, and previous/next navigation.

**Speak:** mode catalogue (12 modes, each with explicit objectives and level), session workspace
with transcript, microphone control, text fallback, feedback-style selector, Azerbaijani help.

**Vocabulary:** due queue, full list with search, topics with mastery, practice modes
(flashcards, recall, listening, sentence creation, spoken, contextual MCQ). Recognition and active
recall are tracked separately.

**Progress:** objective metrics (practice time, streak, sessions, completion), skill mastery per
skill, weekly activity, weak topics, learning history. Subjective coach estimates are always
labelled as such.

**Settings:** profile, theme, PWA install, Azerbaijani support, feedback style, daily target.

## 5. Tutor experience

**My Students:** stat row, search and status filter, clickable student cards (avatar/initials,
name, level, current chapter, completion %, last active, homework indicator, speaking activity,
status), invite dialog, invitations list with resend/revoke.

**Student profile sections:** Overview · Curriculum · Grammar · Vocabulary · Speaking · Listening ·
Assignments · Teacher Notes · Learning History · Settings. Each section is a route
(`/tutor/students/:id/:section`) so it is linkable and refresh-safe.

**Curriculum:** level and chapter management (content editor arrives with M3).

## 6. Exercise engine (M3+)

Twenty exercise types (multiple choice, fill-in-the-blank, sentence ordering, error correction,
matching, true/false, short answer, sentence transformation, negative formation, question
formation, vocabulary recall, listening comprehension, dictation, speaking response, picture
description, conversation completion, reading comprehension, guided writing, timed revision,
chapter assessment). Attempts, scores, explanations, hints, difficulty, retry, persistence,
randomisation, keyboard/touch accessibility. Deterministic grading whenever rules allow; AI
evaluation only for open production and never presented as objective measurement.

## 7. AI speaking coach (M7)

Modes: guided, free, grammar-focused, roleplay, picture description, storytelling, interview,
rapid response, pronunciation, opinion, debate, vocabulary-in-conversation. Behaviour: clear speech,
one question at a time, encourage longer answers, meaningful follow-ups, no interruptions, remember
the objective, reinforce weak grammar, short turns. Feedback styles: gentle, detailed, fluency
first, grammar focus. Speech pipeline: browser capture → server-side transcription → LLM →
server-side TTS, with text fallback, permission handling, status, error recovery, iOS/Android
differences handled. Provider abstraction and usage limits are mandatory.

## 8. Azerbaijani support (M8)

Grammar explanations, vocabulary translation, sentence-structure contrasts, contextual hints,
correction explanations, in-conversation help with return to English, tutor-controlled toggle for
assessments. Explanations explain the mechanism (what "doesn't" does), not just the translation.
Architecture supports additional languages later.

## 9. Analytics (M5)

Track completion and performance across grammar, vocabulary, listening, speaking, reading, writing,
pronunciation. Metrics have written definitions (see Progress screen copy and `docs/ARCHITECTURE.md`
data model). No meaningless AI percentages; subjective and objective metrics are visually distinct.

## 10. Demo data policy

Until a feature's real data exists, screens use `src/demo/*` fixtures and display a `DemoNotice`.
Demo data is never written to the database and never ships once the real feature lands.
