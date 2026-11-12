import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { curriculumKeys, useCurriculumServices } from '@/features/curriculum/CurriculumProvider'
import { computeProgression } from '@/features/curriculum/progression'
import { useVocabularyBank, useVocabularyServices, vocabularyKeys } from '@/features/vocabulary/VocabularyProvider'
import { deviceTimeZone } from '@/features/vocabulary/srs/time'
import { computeLearningAnalytics, type LearningAnalytics, type LearningRecords } from './analytics'

/**
 * Loads every learning record the signed-in account may read for `studentId` and computes the
 * analytics once per data change.
 *
 * - All queries live under `['student', <id>, …]`, the keys M2 clears on sign-out and account
 *   switch (`queryClient.clear()`), so nothing of one student is ever shown to another.
 * - RLS decides what comes back: a student only ever receives their own rows; the tutor receives
 *   a linked student's rows. The hook does not need to know which case it is in.
 * - "Now" is fixed when the screen mounts so numbers do not drift between renders; calendar days
 *   follow the device time zone (docs/PROGRESS_METRICS.md).
 */
export interface LearningAnalyticsQuery {
  readonly analytics: LearningAnalytics | undefined
  readonly records: LearningRecords | undefined
  readonly isLoading: boolean
  readonly error: unknown
}

export function useLearningAnalytics(studentId: string | null): LearningAnalyticsQuery {
  const { content, progress, assessments } = useCurriculumServices()
  const id = studentId ?? ''
  const enabled = id.length > 0
  const [clock] = useState(() => ({ now: new Date(), timeZone: deviceTimeZone() }))

  const chapters = useQuery({ queryKey: curriculumKeys.chapters, queryFn: () => content.listChapters(), staleTime: Infinity })
  const lessonProgress = useQuery({ queryKey: curriculumKeys.lessonProgress(id), queryFn: () => progress.listLessonProgress(id), enabled })
  const overrides = useQuery({ queryKey: curriculumKeys.overrides(id), queryFn: () => progress.listChapterOverrides(id), enabled })
  const attempts = useQuery({ queryKey: curriculumKeys.attempts(id), queryFn: () => progress.listAttempts(id), enabled })
  const checks = useQuery({ queryKey: curriculumKeys.assessments(id), queryFn: () => assessments.listAttempts(id), enabled })
  const bank = useVocabularyBank()
  // Read-only reader: the tutor reads a linked student's rows; RLS, not the client, decides.
  const { records: reader } = useVocabularyServices()
  const vocabulary = {
    states: useQuery({ queryKey: vocabularyKeys.states(id), queryFn: () => reader.listStates(id), enabled, networkMode: 'always' as const }),
    reviews: useQuery({ queryKey: vocabularyKeys.reviews(id), queryFn: () => reader.listReviews(id), enabled, networkMode: 'always' as const }),
  }

  const records = useMemo<LearningRecords | undefined>(() => {
    if (!enabled || !chapters.data || !lessonProgress.data || !overrides.data || !attempts.data || !checks.data || !bank.data || !vocabulary.states.data || !vocabulary.reviews.data) {
      return undefined
    }
    return {
      studentId: id,
      chapters: chapters.data,
      progression: computeProgression({ chapters: chapters.data, lessonProgress: lessonProgress.data, overrides: overrides.data }),
      lessonProgress: lessonProgress.data,
      attempts: attempts.data,
      assessments: checks.data,
      vocabularyEntries: bank.data,
      vocabularyStates: vocabulary.states.data,
      vocabularyReviews: vocabulary.reviews.data,
    }
  }, [enabled, id, chapters.data, lessonProgress.data, overrides.data, attempts.data, checks.data, bank.data, vocabulary.states.data, vocabulary.reviews.data])

  const analytics = useMemo(() => (records ? computeLearningAnalytics(records, clock) : undefined), [records, clock])

  return {
    analytics,
    records,
    isLoading:
      enabled &&
      records === undefined &&
      !(chapters.error || lessonProgress.error || overrides.error || attempts.error || checks.error || bank.error || vocabulary.states.error || vocabulary.reviews.error),
    error:
      chapters.error ??
      lessonProgress.error ??
      overrides.error ??
      attempts.error ??
      checks.error ??
      bank.error ??
      vocabulary.states.error ??
      vocabulary.reviews.error ??
      null,
  }
}
