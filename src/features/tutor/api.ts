import { FunctionsHttpError } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { env } from '@/config/env'
import { DEMO_INVITATIONS, DEMO_STUDENTS } from '@/demo/students'
import { appRedirectUrl } from '@/features/auth/auth-url'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { AccountEventRow, AccountStatus, InvitationRow, ProfileRow, SupportLanguage, TutorStudentRow } from '@/lib/supabase/database.types'

/* ------------------------------------------------------------------------------------------ */
/* Types                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export interface StudentAccount {
  readonly id: string
  readonly email: string
  readonly fullName: string
  readonly status: AccountStatus
  readonly supportLanguage: SupportLanguage
  readonly linkedAt: string
  readonly onboardingCompletedAt: string | null
  /** Student-owned preferences (`profiles.preferences`), read-only for the tutor. */
  preferences: Record<string, unknown>
}

export type InvitationDisplayStatus = 'pending' | 'expired' | 'accepted' | 'revoked'

export interface Invitation {
  readonly id: string
  readonly email: string
  readonly fullName: string
  readonly status: InvitationDisplayStatus
  readonly sentAt: string
  readonly expiresAt: string
  readonly resendCount: number
  readonly acceptedAt: string | null
  readonly userId: string | null
}

export interface AccountEvent {
  readonly id: number
  readonly type: AccountEventRow['event_type']
  readonly at: string
  readonly metadata: Record<string, unknown>
}

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  invited: 'Invited',
  active: 'Active',
  disabled: 'Disabled',
}

export const STUDENTS_KEY = ['tutor', 'students'] as const
export const INVITATIONS_KEY = ['tutor', 'invitations'] as const
export const EVENTS_KEY = ['tutor', 'events'] as const

export function invitationDisplayStatus(row: Pick<InvitationRow, 'status' | 'expires_at'>, now = Date.now()): InvitationDisplayStatus {
  if (row.status === 'pending' && new Date(row.expires_at).getTime() < now) return 'expired'
  if (row.status === 'expired') return 'expired'
  return row.status
}

function mapInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    status: invitationDisplayStatus(row),
    sentAt: row.sent_at,
    expiresAt: row.expires_at,
    resendCount: row.resend_count,
    acceptedAt: row.accepted_at,
    userId: row.user_id,
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Preview fixtures (labelled demo data; only when Supabase is NOT configured)                 */
/* ------------------------------------------------------------------------------------------ */

const PREVIEW_STUDENTS: StudentAccount[] = DEMO_STUDENTS.map((s) => ({
  id: s.id,
  email: s.email,
  fullName: s.fullName,
  status: s.status === 'disabled' ? 'disabled' : 'active',
  supportLanguage: 'az',
  linkedAt: '2026-10-12T09:00:00Z',
  onboardingCompletedAt: '2026-10-12T09:10:00Z',
  preferences: {},
}))

const PREVIEW_INVITATIONS: Invitation[] = DEMO_INVITATIONS.map((i) => ({
  id: i.id,
  email: i.email,
  fullName: '',
  status: i.status,
  sentAt: i.sentAt,
  expiresAt: i.expiresAt,
  resendCount: 0,
  acceptedAt: null,
  userId: null,
}))

/* ------------------------------------------------------------------------------------------ */
/* Queries                                                                                    */
/* ------------------------------------------------------------------------------------------ */

async function fetchStudents(tutorId: string): Promise<StudentAccount[]> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Authentication is not configured in this build.')
  const links = await client.from('tutor_students').select('student_id, created_at').eq('tutor_id', tutorId)
  if (links.error) throw new Error(links.error.message)
  const linkRows = links.data as Pick<TutorStudentRow, 'student_id' | 'created_at'>[]
  const ids = linkRows.map((l) => l.student_id)
  if (ids.length === 0) return []
  const profiles = await client.from('profiles').select('*').in('id', ids)
  if (profiles.error) throw new Error(profiles.error.message)
  const linkedAt = new Map(linkRows.map((l) => [l.student_id, l.created_at]))
  return (profiles.data as ProfileRow[])
    .map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      status: p.status,
      supportLanguage: p.support_language,
      linkedAt: linkedAt.get(p.id) ?? p.created_at,
      onboardingCompletedAt: p.onboarding_completed_at,
      preferences: p.preferences,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName) || a.email.localeCompare(b.email))
}

export function useStudents(tutorId: string) {
  return useQuery({
    queryKey: [...STUDENTS_KEY, tutorId],
    queryFn: () => (env.uiPreview ? PREVIEW_STUDENTS : fetchStudents(tutorId)),
    staleTime: 15_000,
  })
}

export function useStudent(tutorId: string, studentId: string) {
  const students = useStudents(tutorId)
  return { ...students, data: students.data?.find((s) => s.id === studentId) ?? null }
}

async function fetchInvitations(tutorId: string): Promise<Invitation[]> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Authentication is not configured in this build.')
  const { data, error } = await client
    .from('invitations')
    .select('*')
    .eq('invited_by', tutorId)
    .order('sent_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as InvitationRow[]).map(mapInvitation)
}

export function useInvitations(tutorId: string) {
  return useQuery({
    queryKey: [...INVITATIONS_KEY, tutorId],
    queryFn: () => (env.uiPreview ? PREVIEW_INVITATIONS : fetchInvitations(tutorId)),
    staleTime: 15_000,
  })
}

async function fetchEvents(userId: string): Promise<AccountEvent[]> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Authentication is not configured in this build.')
  const { data, error } = await client
    .from('account_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data as AccountEventRow[]).map((e) => ({ id: e.id, type: e.event_type, at: e.created_at, metadata: e.metadata }))
}

export function useStudentEvents(studentId: string) {
  return useQuery({
    queryKey: [...EVENTS_KEY, studentId],
    queryFn: () => (env.uiPreview ? [] : fetchEvents(studentId)),
    staleTime: 15_000,
  })
}

/* ------------------------------------------------------------------------------------------ */
/* Edge Function calls                                                                        */
/* ------------------------------------------------------------------------------------------ */

export type StudentAdminRequest =
  | { action: 'invite'; email: string; fullName: string }
  | { action: 'resend'; invitationId: string }
  | { action: 'revoke'; invitationId: string }
  | { action: 'set_status'; studentId: string; status: 'active' | 'disabled' }

export class StudentAdminError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface FunctionEnvelope {
  ok: boolean
  data?: unknown
  error?: { code?: string; message?: string }
}

export async function callStudentAdmin(request: StudentAdminRequest): Promise<unknown> {
  if (env.uiPreview) throw new StudentAdminError('preview', 'Preview mode: account changes are not sent anywhere.')
  const client = getSupabaseClient()
  if (!client) throw new StudentAdminError('unconfigured', 'Authentication is not configured in this build.')
  const body =
    request.action === 'invite' || request.action === 'resend' ? { ...request, redirectTo: appRedirectUrl(env.basePath) } : request
  const { data, error } = await client.functions.invoke<FunctionEnvelope>('student-admin', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = (await error.context.json()) as FunctionEnvelope
        throw new StudentAdminError(payload.error?.code ?? 'error', payload.error?.message ?? 'The request failed.')
      } catch (inner) {
        if (inner instanceof StudentAdminError) throw inner
      }
    }
    throw new StudentAdminError('network', 'Could not reach the server. Check your connection and try again.')
  }
  if (!data?.ok) throw new StudentAdminError(data?.error?.code ?? 'error', data?.error?.message ?? 'The request failed.')
  return data.data
}

export function useStudentAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: callStudentAdmin,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: STUDENTS_KEY }),
        queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: EVENTS_KEY }),
      ])
    },
  })
}
