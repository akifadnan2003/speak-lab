import { grade, emptyAnswer } from '@/features/exercises/engine/grade'
import {
  assessmentLessonIndex,
  ASSESSMENT_ATTEMPT_TTL_MS,
  countUsedAttempts,
  MAX_ASSESSMENT_ATTEMPTS,
  mergeAssessmentResults,
  revealAnswersAfter,
} from '../assessment-rules'
import { CURRICULUM } from '../content'
import type {
  AssessmentAnswer,
  AssessmentAttemptSummary,
  AssessmentExerciseResult,
  AssessmentGateway,
  ChapterAccessOverride,
  ExerciseAttemptRecord,
  LessonProgressRecord,
  ProgressRepository,
} from '../ports'
import { scoreLesson } from '../progression'
import type { Chapter } from '../schema'

/**
 * In-memory ProgressRepository and AssessmentGateway. Used by tests, by the localStorage
 * implementation (preview builds) and as the reference behaviour for the Supabase ones:
 * the same rules module decides what counts as progress and when answers are revealed.
 * Records are copied on the way out so callers cannot mutate the store.
 */
export interface StoredAssessment extends AssessmentAttemptSummary {
  readonly answers?: readonly AssessmentAnswer[]
}

export interface MemoryStore {
  lessonProgress: LessonProgressRecord[]
  attempts: ExerciseAttemptRecord[]
  overrides: ChapterAccessOverride[]
  assessments: StoredAssessment[]
}

export function createMemoryStore(): MemoryStore {
  return { lessonProgress: [], attempts: [], overrides: [], assessments: [] }
}

export function createMemoryProgressRepository(
  store: MemoryStore = createMemoryStore(),
  onChange?: (store: MemoryStore) => void,
  chapters: readonly Chapter[] = CURRICULUM,
): ProgressRepository {
  const assessmentLessons = assessmentLessonIndex(chapters)
  return {
    async listLessonProgress(studentId) {
      return mergeAssessmentResults(
        store.lessonProgress.filter((r) => r.studentId === studentId),
        store.assessments.filter((a) => a.studentId === studentId),
        assessmentLessons,
      )
    },
    async upsertLessonProgress(record) {
      if (assessmentLessons.has(`${record.chapterId}/${record.lessonId}`)) {
        throw new Error('Assessment results are recorded by the assessment gateway, not as lesson progress.')
      }
      const i = store.lessonProgress.findIndex(
        (r) => r.studentId === record.studentId && r.chapterId === record.chapterId && r.lessonId === record.lessonId,
      )
      if (i >= 0) store.lessonProgress[i] = record
      else store.lessonProgress.push(record)
      onChange?.(store)
    },
    async recordAttempt(attempt) {
      if (store.attempts.some((a) => a.id === attempt.id)) return
      store.attempts.push(attempt)
      onChange?.(store)
    },
    async listAttempts(studentId, filter) {
      return store.attempts.filter(
        (a) => a.studentId === studentId && (filter?.lessonId === undefined || a.lessonId === filter.lessonId),
      )
    },
    async listChapterOverrides(studentId) {
      return store.overrides.filter((o) => o.studentId === studentId)
    },
    async setChapterOverride(override) {
      store.overrides = store.overrides.filter(
        (o) => !(o.studentId === override.studentId && o.chapterId === override.chapterId),
      )
      store.overrides.push({
        studentId: override.studentId,
        chapterId: override.chapterId,
        kind: override.kind,
        createdAt: override.createdAt,
      })
      onChange?.(store)
    },
    async clearChapterOverride(studentId, chapterId) {
      store.overrides = store.overrides.filter((o) => !(o.studentId === studentId && o.chapterId === chapterId))
      onChange?.(store)
    },
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Client-side assessment gateway for builds without a backend (preview mode and unit tests).
 * It applies the same attempt, retake and disclosure rules as the Edge Function, but grades in
 * the browser, which is why real builds never use it.
 */
export function createMemoryAssessmentGateway(
  store: MemoryStore = createMemoryStore(),
  onChange?: (store: MemoryStore) => void,
  chapters: readonly Chapter[] = CURRICULUM,
  now: () => number = () => Date.now(),
): AssessmentGateway {
  const findLesson = (chapterId: string, lessonId: string) => {
    const chapter = chapters.find((c) => c.id === chapterId)
    const lesson = chapter?.lessons.find((l) => l.id === lessonId)
    if (!chapter || !lesson || lesson.kind !== 'assessment') throw new Error('This lesson is not an assessment.')
    return { chapter, lesson }
  }
  const forLesson = (studentId: string, chapterId: string, lessonId: string) =>
    store.assessments.filter((a) => a.studentId === studentId && a.chapterId === chapterId && a.lessonId === lessonId)

  return {
    async start({ studentId, chapterId, lessonId }) {
      const { chapter } = findLesson(chapterId, lessonId)
      const existing = forLesson(studentId, chapterId, lessonId)
      const attemptsUsed = countUsedAttempts(existing, chapter.version)
      const open = existing.find((a) => a.status === 'in_progress')
      if (open && new Date(open.expiresAt).getTime() > now()) {
        return { attempt: { ...open }, attemptsUsed, attemptsAllowed: MAX_ASSESSMENT_ATTEMPTS }
      }
      if (open) {
        store.assessments = store.assessments.map((a) => (a.id === open.id ? { ...a, status: 'voided' } : a))
      }
      if (attemptsUsed >= MAX_ASSESSMENT_ATTEMPTS) {
        throw new Error('No attempts left for this chapter check. Ask your tutor to allow a retake.')
      }
      const started = new Date(now())
      const attempt: StoredAssessment = {
        id: newId(),
        studentId,
        chapterId,
        chapterVersion: chapter.version,
        lessonId,
        attemptNumber: attemptsUsed + 1,
        status: 'in_progress',
        passMark: chapter.completion.passMark,
        startedAt: started.toISOString(),
        expiresAt: new Date(started.getTime() + ASSESSMENT_ATTEMPT_TTL_MS).toISOString(),
      }
      store.assessments.push(attempt)
      onChange?.(store)
      return { attempt: { ...attempt }, attemptsUsed, attemptsAllowed: MAX_ASSESSMENT_ATTEMPTS }
    },

    async submit({ studentId, attemptId, answers }) {
      const index = store.assessments.findIndex((a) => a.id === attemptId && a.studentId === studentId)
      const attempt = store.assessments[index]
      if (!attempt) throw new Error('Unknown attempt.')
      const { chapter, lesson } = findLesson(attempt.chapterId, attempt.lessonId)
      const byId = new Map(answers.map((a) => [a.exerciseId, a.answer]))
      const graded = lesson.exercises.map((exercise) => {
        const answer = byId.get(exercise.id) ?? emptyAnswer(exercise)
        const result = answer.type === exercise.type ? grade(exercise, answer) : grade(exercise, emptyAnswer(exercise))
        return { exercise, result }
      })
      let stored = attempt
      if (attempt.status === 'in_progress') {
        const score = scoreLesson(graded.map((g) => g.result.score))
        stored = {
          ...attempt,
          status: 'submitted',
          answers: [...answers],
          score,
          passed: score >= chapter.completion.passMark,
          submittedAt: new Date(now()).toISOString(),
        }
        store.assessments[index] = stored
        onChange?.(store)
      } else if (attempt.status === 'voided') {
        throw new Error('This attempt was cancelled.')
      }
      const attemptsUsed = countUsedAttempts(forLesson(studentId, attempt.chapterId, attempt.lessonId), chapter.version)
      const revealAnswers = revealAnswersAfter(stored.passed === true, attemptsUsed)
      const results: AssessmentExerciseResult[] = graded.map(({ exercise, result }) => ({
        exerciseId: exercise.id,
        correct: result.correct,
        score: result.score,
        ...(revealAnswers ? { correctAnswer: result.correctAnswer, parts: result.parts } : {}),
      }))
      const { answers: _answers, ...summary } = stored
      return { attempt: summary, results, revealAnswers, attemptsUsed, attemptsAllowed: MAX_ASSESSMENT_ATTEMPTS }
    },

    async listAttempts(studentId, filter) {
      return store.assessments
        .filter(
          (a) =>
            a.studentId === studentId &&
            (filter?.chapterId === undefined || a.chapterId === filter.chapterId) &&
            (filter?.lessonId === undefined || a.lessonId === filter.lessonId),
        )
        .map(({ answers: _answers, ...summary }) => summary)
    },

    async reset({ studentId, chapterId, lessonId }) {
      store.assessments = store.assessments.map((a) =>
        a.studentId === studentId && a.chapterId === chapterId && a.lessonId === lessonId && a.status !== 'voided'
          ? { ...a, status: 'voided' }
          : a,
      )
      onChange?.(store)
    },
  }
}
