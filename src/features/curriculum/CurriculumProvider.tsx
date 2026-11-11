/* oxlint-disable react/only-export-components -- provider module exporting its hooks */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createStaticContentSource } from './content'
import { createLocalStorageProgressRepository } from './persistence/local-storage'
import type { ContentSource, ExerciseAttemptRecord, LessonProgressRecord, ProgressRepository } from './ports'
import { computeProgression, type ChapterState } from './progression'

/**
 * Dependency injection point for curriculum content and progress persistence.
 *
 * Defaults (M3): bundled static content + localStorage progress. When the
 * Supabase repositories exist they are passed here from `App.tsx`; nothing
 * below this provider changes.
 */
export interface CurriculumServices {
  readonly content: ContentSource
  readonly progress: ProgressRepository
  /** Where progress is stored, for honest UI labelling. */
  readonly storage: 'device' | 'cloud'
}

const CurriculumContext = createContext<CurriculumServices | null>(null)

let defaultServices: CurriculumServices | null = null
function getDefaultServices(): CurriculumServices {
  defaultServices ??= {
    content: createStaticContentSource(),
    progress: createLocalStorageProgressRepository(),
    storage: 'device',
  }
  return defaultServices
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

/** Mutations used by the lesson workspace. */
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
