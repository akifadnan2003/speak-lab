/**
 * Hand-maintained row types for the tables the client reads. Keep in sync with
 * `supabase/migrations/*.sql`. Only the shapes the browser is allowed to see are listed.
 */
export type UserRole = 'tutor' | 'student'
export type AccountStatus = 'invited' | 'active' | 'disabled'
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'
export type SupportLanguage = 'az' | 'none'

export interface ProfileRow {
  id: string
  email: string
  full_name: string
  role: UserRole
  status: AccountStatus
  preferred_language: 'en'
  support_language: SupportLanguage
  preferences: Record<string, unknown>
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}

export type ProfileUpdate = Partial<
  Pick<ProfileRow, 'full_name' | 'preferred_language' | 'support_language' | 'preferences' | 'onboarding_completed_at'>
>

export interface TutorStudentRow {
  tutor_id: string
  student_id: string
  created_at: string
}

export interface InvitationRow {
  id: string
  email: string
  full_name: string
  user_id: string | null
  invited_by: string
  status: InvitationStatus
  sent_at: string
  expires_at: string
  resend_count: number
  accepted_at: string | null
  revoked_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface AccountEventRow {
  id: number
  user_id: string | null
  actor_id: string | null
  event_type:
    | 'owner_bootstrapped'
    | 'invitation_sent'
    | 'invitation_resent'
    | 'invitation_revoked'
    | 'invitation_accepted'
    | 'account_created'
    | 'account_disabled'
    | 'account_reactivated'
    | 'onboarding_completed'
    | 'chapter_override_set'
    | 'chapter_override_cleared'
    | 'assessment_submitted'
    | 'assessment_reset'
    | 'assignment_published'
    | 'assignment_cancelled'
    | 'assignment_submitted'
    | 'assignment_returned'
    | 'assignment_reviewed'
  metadata: Record<string, unknown>
  created_at: string
}

/* ---- M3 learning records (supabase/migrations/20261111150000_curriculum_progress.sql) ---- */

export type LessonProgressStatus = 'in_progress' | 'completed' | 'skipped'
export type ChapterOverrideKind = 'unlock' | 'skip'
export type AssessmentAttemptStatus = 'in_progress' | 'submitted' | 'voided'

export interface LessonProgressRow {
  student_id: string
  chapter_id: string
  lesson_id: string
  status: LessonProgressStatus
  best_score: number | null
  last_score: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ExerciseAttemptRow {
  id: string
  student_id: string
  chapter_id: string
  chapter_version: number
  lesson_id: string
  exercise_id: string
  exercise_type: string
  attempt_number: number
  answer: Record<string, unknown>
  correct: boolean
  score: number
  hint_used: boolean
  created_at: string
}

export interface ChapterAccessOverrideRow {
  student_id: string
  chapter_id: string
  kind: ChapterOverrideKind
  created_by: string
  created_at: string
}

export interface AssessmentAttemptRow {
  id: string
  student_id: string
  chapter_id: string
  chapter_version: number
  lesson_id: string
  attempt_number: number
  status: AssessmentAttemptStatus
  pass_mark: number
  answers: unknown[]
  results: unknown[]
  score: number | null
  passed: boolean | null
  started_at: string
  expires_at: string
  submitted_at: string | null
  voided_at: string | null
}

/* ---- M6 tutor workspace (supabase/migrations/20261112200000_tutor_workspace.sql) ---- */

export type AssignmentKind = 'lesson' | 'vocabulary' | 'written'
export type AssignmentStatus = 'draft' | 'published' | 'cancelled'
export type SubmissionStatus = 'assigned' | 'in_progress' | 'submitted' | 'reviewed'

export interface AssignmentRow {
  id: string
  tutor_id: string
  kind: AssignmentKind
  title: string
  instructions: string
  chapter_id: string | null
  lesson_id: string | null
  requires_pass: boolean
  review_target: number | null
  due_at: string | null
  status: AssignmentStatus
  published_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface AssignmentRecipientRow {
  assignment_id: string
  student_id: string
  status: SubmissionStatus
  draft_text: string
  submitted_text: string | null
  evidence: Record<string, unknown> | null
  started_at: string | null
  submitted_at: string | null
  reviewed_at: string | null
  returned_at: string | null
  late: boolean
  feedback: string | null
  feedback_updated_at: string | null
  created_at: string
  updated_at: string
}

export type TeacherNoteTopic = 'general' | 'grammar' | 'vocabulary' | 'pronunciation' | 'speaking' | 'listening' | 'reading' | 'writing' | 'behaviour' | 'planning'
export type TeacherNotePriority = 'normal' | 'high'

export interface TeacherNoteRow {
  id: string
  tutor_id: string
  student_id: string
  body: string
  topic: TeacherNoteTopic
  priority: TeacherNotePriority
  created_at: string
  updated_at: string
}
