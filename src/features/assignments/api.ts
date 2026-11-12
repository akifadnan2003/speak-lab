import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { env } from '@/config/env'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { AssignmentKind, AssignmentRecipientRow, AssignmentRow, TeacherNotePriority, TeacherNoteRow, TeacherNoteTopic } from '@/lib/supabase/database.types'
import { fromAssignmentRow, fromRecipientRow, type Assignment, type CompletionEvidence, type HomeworkItem, type Submission } from './model'

/**
 * Data access for homework and teacher notes. Every read and write goes through PostgREST under
 * RLS; the server-side triggers decide every status transition (docs/ASSIGNMENTS.md).
 *
 * Query keys: student-scoped data lives under `['student', <id>, …]` so sign-out and account
 * switching clear it with the rest; tutor lists live under `['tutor', …]`.
 */
export class WorkspaceError extends Error {
  readonly code: string
  constructor(message: string, code = 'error') {
    super(message)
    this.name = 'WorkspaceError'
    this.code = code
  }
}

function client() {
  if (env.uiPreview) throw new WorkspaceError('Preview mode: homework and notes need the real backend.', 'preview')
  const c = getSupabaseClient()
  if (!c) throw new WorkspaceError('Authentication is not configured in this build.', 'unconfigured')
  return c
}

/** Turns PostgREST errors (including trigger messages) into readable errors. */
function fail(error: { message: string; code?: string }): never {
  const message = error.message.replace(/^.*?:\s*/, '').trim()
  throw new WorkspaceError(message.length > 0 ? message : error.message, error.code ?? 'error')
}

export const homeworkKeys = {
  student: (studentId: string) => ['student', studentId, 'homework'] as const,
  tutorStudent: (studentId: string) => ['tutor', 'homework', studentId] as const,
  tutorAll: ['tutor', 'homework'] as const,
  notes: (studentId: string) => ['tutor', 'notes', studentId] as const,
}

/* ------------------------------------------------------------------------------------------ */
/* Reads                                                                                      */
/* ------------------------------------------------------------------------------------------ */

async function fetchHomeworkFor(studentId: string): Promise<HomeworkItem[]> {
  const c = client()
  const recipients = await c.from('assignment_recipients').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(500)
  if (recipients.error) fail(recipients.error)
  const rows = recipients.data as AssignmentRecipientRow[]
  if (rows.length === 0) return []
  const assignments = await c
    .from('assignments')
    .select('*')
    .in(
      'id',
      rows.map((r) => r.assignment_id),
    )
  if (assignments.error) fail(assignments.error)
  const byId = new Map((assignments.data as AssignmentRow[]).map((a) => [a.id, fromAssignmentRow(a)]))
  return rows.flatMap((r) => {
    const assignment = byId.get(r.assignment_id)
    return assignment ? [{ assignment, submission: fromRecipientRow(r) }] : []
  })
}

/** The signed-in student's homework (published and cancelled; drafts are invisible by RLS). */
export function useStudentHomework(studentId: string | null) {
  const id = studentId ?? ''
  return useQuery({
    queryKey: homeworkKeys.student(id),
    queryFn: () => (env.uiPreview ? [] : fetchHomeworkFor(id)),
    enabled: id.length > 0,
    staleTime: 15_000,
  })
}

/** Everything the tutor assigned to one linked student, drafts included. */
export function useStudentAssignments(studentId: string) {
  return useQuery({
    queryKey: homeworkKeys.tutorStudent(studentId),
    queryFn: () => (env.uiPreview ? [] : fetchHomeworkFor(studentId)),
    enabled: studentId.length > 0,
    staleTime: 15_000,
  })
}

/* ------------------------------------------------------------------------------------------ */
/* Tutor writes                                                                               */
/* ------------------------------------------------------------------------------------------ */

export interface AssignmentDraft {
  readonly kind: AssignmentKind
  readonly title: string
  readonly instructions: string
  readonly chapterId?: string | null
  readonly lessonId?: string | null
  readonly requiresPass?: boolean
  readonly reviewTarget?: number | null
  readonly dueAt?: string | null
}

function toInsert(tutorId: string, draft: AssignmentDraft, status: 'draft' | 'published') {
  return {
    tutor_id: tutorId,
    kind: draft.kind,
    title: draft.title.trim(),
    instructions: draft.instructions.trim(),
    chapter_id: draft.kind === 'lesson' ? (draft.chapterId ?? null) : null,
    lesson_id: draft.kind === 'lesson' ? (draft.lessonId ?? null) : null,
    requires_pass: draft.kind === 'lesson' ? Boolean(draft.requiresPass) : false,
    review_target: draft.kind === 'vocabulary' ? (draft.reviewTarget ?? null) : null,
    due_at: draft.dueAt ?? null,
    status,
  }
}

export function useAssignmentMutations(tutorId: string) {
  const queryClient = useQueryClient()
  const refresh = async (studentIds: readonly string[]) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: homeworkKeys.tutorAll }),
      ...studentIds.map((id) => queryClient.invalidateQueries({ queryKey: homeworkKeys.student(id) })),
      queryClient.invalidateQueries({ queryKey: ['tutor', 'events'] }),
    ])
  }

  const create = useMutation({
    mutationFn: async ({ draft, studentIds, publish }: { draft: AssignmentDraft; studentIds: readonly string[]; publish: boolean }) => {
      const c = client()
      const inserted = await c.from('assignments').insert(toInsert(tutorId, draft, 'draft')).select('*').single()
      if (inserted.error) fail(inserted.error)
      const assignment = fromAssignmentRow(inserted.data as AssignmentRow)
      const recipients = await c.from('assignment_recipients').insert(studentIds.map((student_id) => ({ assignment_id: assignment.id, student_id })))
      if (recipients.error) fail(recipients.error)
      if (publish) {
        const published = await c.from('assignments').update({ status: 'published' }).eq('id', assignment.id).select('*').single()
        if (published.error) fail(published.error)
        return fromAssignmentRow(published.data as AssignmentRow)
      }
      return assignment
    },
    onSuccess: (_a, variables) => refresh(variables.studentIds),
  })

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<AssignmentDraft, 'title' | 'instructions' | 'dueAt' | 'reviewTarget' | 'chapterId' | 'lessonId' | 'requiresPass'>>; studentIds: readonly string[] }) => {
      const c = client()
      const body: Record<string, unknown> = {}
      if (patch.title !== undefined) body.title = patch.title.trim()
      if (patch.instructions !== undefined) body.instructions = patch.instructions.trim()
      if (patch.dueAt !== undefined) body.due_at = patch.dueAt
      if (patch.reviewTarget !== undefined) body.review_target = patch.reviewTarget
      if (patch.chapterId !== undefined) body.chapter_id = patch.chapterId
      if (patch.lessonId !== undefined) body.lesson_id = patch.lessonId
      if (patch.requiresPass !== undefined) body.requires_pass = patch.requiresPass
      const { data, error } = await c.from('assignments').update(body).eq('id', id).select('*').single()
      if (error) fail(error)
      return fromAssignmentRow(data as AssignmentRow)
    },
    onSuccess: (_a, variables) => refresh(variables.studentIds),
  })

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'published' | 'cancelled'; studentIds: readonly string[] }) => {
      const { data, error } = await client().from('assignments').update({ status }).eq('id', id).select('*').single()
      if (error) fail(error)
      return fromAssignmentRow(data as AssignmentRow)
    },
    onSuccess: (_a, variables) => refresh(variables.studentIds),
  })

  const remove = useMutation({
    mutationFn: async (variables: { id: string; studentIds: readonly string[] }) => {
      const { id } = variables
      const { error } = await client().from('assignments').delete().eq('id', id)
      if (error) fail(error)
    },
    onSuccess: (_a, variables) => refresh(variables.studentIds),
  })

  const review = useMutation({
    mutationFn: async ({ assignmentId, studentId, feedback, status }: { assignmentId: string; studentId: string; feedback?: string; status?: 'reviewed' | 'in_progress' }) => {
      const body: Record<string, unknown> = {}
      if (feedback !== undefined) body.feedback = feedback.trim().length > 0 ? feedback.trim() : null
      if (status !== undefined) body.status = status
      const { data, error } = await client().from('assignment_recipients').update(body).eq('assignment_id', assignmentId).eq('student_id', studentId).select('*').single()
      if (error) fail(error)
      return fromRecipientRow(data as AssignmentRecipientRow)
    },
    onSuccess: (_a, variables) => refresh([variables.studentId]),
  })

  return { create, update, setStatus, remove, review }
}

/* ------------------------------------------------------------------------------------------ */
/* Student writes                                                                             */
/* ------------------------------------------------------------------------------------------ */

export interface CompletionResult {
  readonly completed: boolean
  readonly status: Submission['status']
  readonly evidence?: CompletionEvidence
  readonly progress?: Record<string, unknown>
  readonly already?: boolean
}

export function useHomeworkMutations(studentId: string) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: homeworkKeys.student(studentId) })

  const saveDraft = useMutation({
    mutationFn: async ({ assignmentId, text }: { assignmentId: string; text: string }) => {
      const { data, error } = await client().from('assignment_recipients').update({ draft_text: text }).eq('assignment_id', assignmentId).eq('student_id', studentId).select('*').single()
      if (error) fail(error)
      return fromRecipientRow(data as AssignmentRecipientRow)
    },
    onSuccess: refresh,
    networkMode: 'always',
  })

  const submit = useMutation({
    mutationFn: async ({ assignmentId, text }: { assignmentId: string; text: string }) => {
      const { data, error } = await client()
        .from('assignment_recipients')
        .update({ draft_text: text, status: 'submitted' })
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId)
        .select('*')
        .single()
      if (error) fail(error)
      return fromRecipientRow(data as AssignmentRecipientRow)
    },
    onSuccess: refresh,
  })

  /** Lesson and vocabulary homework: asks the server to verify the records and mark it done. */
  const complete = useMutation({
    mutationFn: async ({ assignmentId }: { assignmentId: string }) => {
      const { data, error } = await client().rpc('complete_assignment', { p_assignment_id: assignmentId })
      if (error) fail(error)
      return data as CompletionResult
    },
    onSuccess: refresh,
  })

  return { saveDraft, submit, complete }
}

/* ------------------------------------------------------------------------------------------ */
/* Teacher notes (tutor only; students have no policy and never receive rows)                 */
/* ------------------------------------------------------------------------------------------ */

export interface TeacherNote {
  readonly id: string
  readonly studentId: string
  readonly body: string
  readonly topic: TeacherNoteTopic
  readonly priority: TeacherNotePriority
  readonly createdAt: string
  readonly updatedAt: string
}

function fromNoteRow(row: TeacherNoteRow): TeacherNote {
  return { id: row.id, studentId: row.student_id, body: row.body, topic: row.topic, priority: row.priority, createdAt: row.created_at, updatedAt: row.updated_at }
}

export function useTeacherNotes(studentId: string) {
  return useQuery({
    queryKey: homeworkKeys.notes(studentId),
    queryFn: async () => {
      if (env.uiPreview) return [] as TeacherNote[]
      const { data, error } = await client().from('teacher_notes').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(500)
      if (error) fail(error)
      return (data as TeacherNoteRow[]).map(fromNoteRow)
    },
    enabled: studentId.length > 0,
    staleTime: 15_000,
  })
}

export function useTeacherNoteMutations(tutorId: string, studentId: string) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: homeworkKeys.notes(studentId) })
  const create = useMutation({
    mutationFn: async (input: { body: string; topic: TeacherNoteTopic; priority: TeacherNotePriority }) => {
      const { data, error } = await client()
        .from('teacher_notes')
        .insert({ tutor_id: tutorId, student_id: studentId, body: input.body.trim(), topic: input.topic, priority: input.priority })
        .select('*')
        .single()
      if (error) fail(error)
      return fromNoteRow(data as TeacherNoteRow)
    },
    onSuccess: refresh,
  })
  const update = useMutation({
    mutationFn: async (input: { id: string; body: string; topic: TeacherNoteTopic; priority: TeacherNotePriority }) => {
      const { data, error } = await client().from('teacher_notes').update({ body: input.body.trim(), topic: input.topic, priority: input.priority }).eq('id', input.id).select('*').single()
      if (error) fail(error)
      return fromNoteRow(data as TeacherNoteRow)
    },
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client().from('teacher_notes').delete().eq('id', id)
      if (error) fail(error)
    },
    onSuccess: refresh,
  })
  return { create, update, remove }
}

export type { Assignment, HomeworkItem, Submission }
