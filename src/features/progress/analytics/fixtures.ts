import type { AssessmentAttemptSummary, ExerciseAttemptRecord, LessonProgressRecord } from '@/features/curriculum/ports'
import { computeProgression } from '@/features/curriculum/progression'
import type { Chapter } from '@/features/curriculum/schema'
import type { VocabularyReviewRecord, VocabularyState } from '@/features/vocabulary/ports'
import type { VocabularyEntry } from '@/features/vocabulary/schema'
import { createInitialState } from '@/features/vocabulary/srs/scheduler'
import type { LearningRecords } from './types'

/**
 * Test-only builders for `LearningRecords`. Never used in the app; the real records come from
 * Supabase (or the device repositories in preview mode).
 */
export const STUDENT = '11111111-1111-4111-8111-111111111111'

export interface RecordsOverrides {
  readonly chapters?: readonly Chapter[]
  readonly lessonProgress?: readonly LessonProgressRecord[]
  readonly attempts?: readonly ExerciseAttemptRecord[]
  readonly assessments?: readonly AssessmentAttemptSummary[]
  readonly overrides?: { chapterId: string; kind: 'unlock' | 'skip' }[]
  readonly vocabularyEntries?: readonly VocabularyEntry[]
  readonly vocabularyStates?: readonly VocabularyState[]
  readonly vocabularyReviews?: readonly VocabularyReviewRecord[]
}

export function buildRecords(chapters: readonly Chapter[], overrides: RecordsOverrides = {}): LearningRecords {
  const lessonProgress = overrides.lessonProgress ?? []
  return {
    studentId: STUDENT,
    chapters: overrides.chapters ?? chapters,
    progression: computeProgression({
      chapters: overrides.chapters ?? chapters,
      lessonProgress,
      overrides: (overrides.overrides ?? []).map((o) => ({ ...o, studentId: STUDENT, createdAt: '2026-11-01T00:00:00.000Z' })),
    }),
    lessonProgress,
    attempts: overrides.attempts ?? [],
    assessments: overrides.assessments ?? [],
    vocabularyEntries: overrides.vocabularyEntries ?? [],
    vocabularyStates: overrides.vocabularyStates ?? [],
    vocabularyReviews: overrides.vocabularyReviews ?? [],
  }
}

export function completedLesson(chapterId: string, lessonId: string, completedAt: string, bestScore = 90): LessonProgressRecord {
  return { studentId: STUDENT, chapterId, lessonId, status: 'completed', bestScore, lastScore: bestScore, completedAt, updatedAt: completedAt }
}

export function inProgressLesson(chapterId: string, lessonId: string, updatedAt: string): LessonProgressRecord {
  return { studentId: STUDENT, chapterId, lessonId, status: 'in_progress', updatedAt }
}

let attemptSeq = 0
export function attempt(
  chapterId: string,
  lessonId: string,
  exerciseId: string,
  input: { correct: boolean; at: string; attemptNumber?: number; type?: ExerciseAttemptRecord['exerciseType']; id?: string; score?: number },
): ExerciseAttemptRecord {
  attemptSeq += 1
  return {
    id: input.id ?? `aaaaaaaa-0000-4000-8000-${attemptSeq.toString().padStart(12, '0')}`,
    studentId: STUDENT,
    chapterId,
    chapterVersion: 1,
    lessonId,
    exerciseId,
    exerciseType: input.type ?? 'multiple_choice',
    attemptNumber: input.attemptNumber ?? 1,
    answer: { type: 'multiple_choice', optionId: 'a' },
    correct: input.correct,
    score: input.score ?? (input.correct ? 1 : 0),
    hintUsed: false,
    createdAt: input.at,
  }
}

let checkSeq = 0
export function check(
  chapterId: string,
  lessonId: string,
  input: { score: number; passMark?: number; at: string; attemptNumber?: number; status?: AssessmentAttemptSummary['status'] },
): AssessmentAttemptSummary {
  checkSeq += 1
  const passMark = input.passMark ?? 80
  const status = input.status ?? 'submitted'
  return {
    id: `cccccccc-0000-4000-8000-${checkSeq.toString().padStart(12, '0')}`,
    studentId: STUDENT,
    chapterId,
    chapterVersion: 1,
    lessonId,
    attemptNumber: input.attemptNumber ?? checkSeq,
    status,
    passMark,
    ...(status === 'submitted' ? { score: input.score, passed: input.score >= passMark, submittedAt: input.at } : {}),
    startedAt: input.at,
    expiresAt: input.at,
  }
}

export function vocabState(entryId: string, input: Partial<VocabularyState> & { at?: string } = {}): VocabularyState {
  const at = new Date(input.at ?? '2026-11-01T09:00:00.000Z')
  const { at: _ignored, ...rest } = input
  return { ...createInitialState(STUDENT, entryId, at), ...rest }
}

let reviewSeq = 0
export function review(entryId: string, input: { correct: boolean; at: string; skill?: VocabularyReviewRecord['skill']; id?: string }): VocabularyReviewRecord {
  reviewSeq += 1
  return {
    id: input.id ?? `rev-fixture-${reviewSeq.toString().padStart(5, '0')}`,
    studentId: STUDENT,
    entryId,
    modeId: input.skill === 'recall' ? 'active_recall' : 'meaning_choice',
    skill: input.skill ?? 'recognition',
    correct: input.correct,
    quality: input.correct ? 4 : 1,
    hintUsed: false,
    reviewedAt: input.at,
    intervalDaysAfter: input.correct ? 1 : 0,
    stageAfter: 'learning',
  }
}
