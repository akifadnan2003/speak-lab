/* oxlint-disable react/only-export-components -- provider module exporting its hooks */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { env } from '@/config/env'
import { getSupabaseClient } from '@/lib/supabase/client'
import { createStaticContentSource, CURRICULUM } from './content'
import { redactAssessmentKeys } from './content/redact'
import { createLocalStorageAssessmentGateway, createLocalStorageProgressRepository } from './persistence/local-storage'
import { createSupabaseAssessmentGateway, createSupabaseProgressRepository } from './persistence/supabase'
import type {
  AssessmentAnswer,
  AssessmentGateway,
  ChapterAccessOverride,
  ContentSource,
  ExerciseAttemptRecord,
  LessonProgressRecord,
  ProgressRepository,
} from './ports'
import { computeProgression, type ChapterState } from './progression'

/**
 * Dependency injection point for curriculum content and progress persistence.
 *
 * Real builds (Supabase configured): Postgres-backed progress under RLS, server-graded
 * assessments through the `assessment` Edge Function, and content with assessment answer keys
 * removed. Preview builds (no backend): bundled content and a localStorage store, labelled as
 * device-only in the UI. Nothing below this provider knows which one it is talking to.
 */
export interface CurriculumServices {
  readonly content: ContentSource
  readonly progress: ProgressRepository
  readonly assessments: AssessmentGateway
  /** Where progress is stored, for honest UI labelling. */
  readonly storage: 'device' | 'cloud'
}

const CurriculumContext = createContext<CurriculumServices | null>(null)

let defaultServices: CurriculumServices | null = null
function getDefaultServices(): CurriculumServices {
  if (defaultServices) return defaultServices
  const client = env.uiPreview ? null : getSupabaseClient()
  if (client) {
    const chapters = redactAssessmentKeys(CURRICULUM)
    defaultServices = {
      content: createStaticContentSource(chapters),
      progress: createSupabaseProgressRepository(client, CURRICULUM),
      assessments: createSupabaseAssessmentGateway(client),
      storage: 'cloud',
    }
  } else {
    defaultServices = {
      content: createStaticContentSource(),
      progress: createLocalStorageProgressRepository(),
      assessments: createLocalStorageAssessmentGateway(),
      storage: 'device',
    }
  }
  return defaultServices
}

/** Test seam: forget the cached services so a new environment or client is picked up. */
export function resetCurriculumServicesForTests(): void {
  defaultServices = null
}

export function CurriculumProvider({ services, children }: { services?: CurriculumServices; children: ReactNode }) {
  const value = useMemo(() => services ?? getDefaultServices(), [services])
  return <CurriculumContext.Provider value={value}>{children}</CurriculumContext.Provider>
}

export function useCurriculumServices(): CurriculumServices {
  return useContext(CurriculumContext) ?? getDefaultServices()
}

export const curriculumKeys = {
  chapters: ['curriculum', 'chapters'] as const,
  lessonProgress: (studentId: string) => ['student', studentId, 'lesson-progress'] as const,
  overrides: (studentId: string) => ['student', studentId, 'chapter-overrides'] as const,
  attempts: (studentId: string, lessonId?: string) => ['student', studentId, 'attempts', lessonId ?? 'all'] as const,
  assessments: (studentId: string, chapterId?: string, lessonId?: string) =>
    ['student', studentId, 'assessments', chapterId ?? 'all', lessonId ?? 'all'] as const,
}

export function useChapters() {
  const { content } = useCurriculumServices()
  return useQuery({ queryKey: curriculumKeys.chapters, queryFn: () => content.listChapters(), staleTime: Infinity })
}

/** Full progression map for a student (chapter + lesson statuses). */
export function useProgression(studentId: string | null) {
  const { content, progress } = useCurriculumServices()
  const id = studentId ?? ''
  const chapters = useQuery({ queryKey: curriculumKeys.chapters, queryFn: () => content.listChapters(), staleTime: Infinity })
  const lessonProgress = useQuery({
    queryKey: curriculumKeys.lessonProgress(id),
    queryFn: () => progress.listLessonProgress(id),
    enabled: id.length > 0,
  })
  const overrides = useQuery({
    queryKey: curriculumKeys.overrides(id),
    queryFn: () => progress.listChapterOverrides(id),
    enabled: id.length > 0,
  })

  const states = useMemo<ReadonlyMap<string, ChapterState> | undefined>(() => {
    if (!chapters.data || !lessonProgress.data || !overrides.data) return undefined
    return computeProgression({ chapters: chapters.data, lessonProgress: lessonProgress.data, overrides: overrides.data })
  }, [chapters.data, lessonProgress.data, overrides.data])

  return {
    states,
    chapters: chapters.data,
    isLoading: chapters.isLoading || lessonProgress.isLoading || overrides.isLoading,
    error: chapters.error ?? lessonProgress.error ?? overrides.error,
  }
}

/** Mutations used by the lesson workspace (practice lessons). */
export function useProgressMutations(studentId: string) {
  const { progress } = useCurriculumServices()
  const client = useQueryClient()
  const upsertLesson = useMutation({
    mutationFn: (record: LessonProgressRecord) => progress.upsertLessonProgress(record),
    onSuccess: () => client.invalidateQueries({ queryKey: curriculumKeys.lessonProgress(studentId) }),
  })
  const recordAttempt = useMutation({
    mutationFn: (attempt: ExerciseAttemptRecord) => progress.recordAttempt(attempt),
    onSuccess: () => client.invalidateQueries({ queryKey: ['student', studentId, 'attempts'] }),
  })
  return { upsertLesson, recordAttempt }
}

/** Submitted and open attempts for one assessment lesson. */
export function useAssessmentAttempts(studentId: string | null, chapterId: string, lessonId: string) {
  const { assessments } = useCurriculumServices()
  const id = studentId ?? ''
  return useQuery({
    queryKey: curriculumKeys.assessments(id, chapterId, lessonId),
    queryFn: () => assessments.listAttempts(id, { chapterId, lessonId }),
    enabled: id.length > 0 && chapterId.length > 0 && lessonId.length > 0,
  })
}

/** Start / submit an assessment (student) and reset one (tutor). Results refresh the progression. */
export function useAssessmentActions(studentId: string) {
  const { assessments } = useCurriculumServices()
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: curriculumKeys.lessonProgress(studentId) }),
      client.invalidateQueries({ queryKey: ['student', studentId, 'assessments'] }),
    ])
  const start = useMutation({
    mutationFn: (input: { chapterId: string; lessonId: string }) => assessments.start({ studentId, ...input }),
    onSuccess: () => refresh(),
  })
  const submit = useMutation({
    mutationFn: (input: { attemptId: string; answers: readonly AssessmentAnswer[] }) => assessments.submit({ studentId, ...input }),
    onSuccess: () => refresh(),
  })
  const reset = useMutation({
    mutationFn: (input: { chapterId: string; lessonId: string }) => assessments.reset({ studentId, ...input }),
    onSuccess: () => refresh(),
  })
  return { start, submit, reset }
}

/** Tutor: unlock, skip or clear an override for a linked student. */
export function useChapterOverrideMutations(studentId: string, tutorId: string) {
  const { progress } = useCurriculumServices()
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: curriculumKeys.overrides(studentId) })
  const set = useMutation({
    mutationFn: (input: { chapterId: string; kind: ChapterAccessOverride['kind'] }) =>
      progress.setChapterOverride({ studentId, chapterId: input.chapterId, kind: input.kind, createdAt: new Date().toISOString(), createdBy: tutorId }),
    onSuccess: () => refresh(),
  })
  const clear = useMutation({
    mutationFn: (chapterId: string) => progress.clearChapterOverride(studentId, chapterId),
    onSuccess: () => refresh(),
  })
  /** Placement: skip every chapter below `level` and clear overrides from that level upward. */
  const placeAtLevel = useMutation({
    mutationFn: async (input: { level: string; chapters: readonly { id: string; level: string }[]; levels: readonly string[] }) => {
      const target = input.levels.indexOf(input.level)
      const existing = new Map((await progress.listChapterOverrides(studentId)).map((o) => [o.chapterId, o.kind]))
      for (const chapter of input.chapters) {
        const below = input.levels.indexOf(chapter.level) < target
        const current = existing.get(chapter.id)
        if (below && current !== 'skip') {
          await progress.setChapterOverride({ studentId, chapterId: chapter.id, kind: 'skip', createdAt: new Date().toISOString(), createdBy: tutorId })
        } else if (!below && current) {
          await progress.clearChapterOverride(studentId, chapter.id)
        }
      }
    },
    onSuccess: () => refresh(),
  })
  return { set, clear, placeAtLevel }
}
