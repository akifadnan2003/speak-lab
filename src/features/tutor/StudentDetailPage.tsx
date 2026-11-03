import { ArrowLeft, Ban, CheckCircle2, Languages, Mail, UserCheck, UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { findStudentProfile } from '@/demo/students'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatRelative } from '@/lib/utils'
import { ACCOUNT_STATUS_LABEL, StudentAdminError, useStudent, useStudentAdmin, useStudentEvents, type AccountEvent, type StudentAccount } from './api'
import { DemoStudentSections } from './DemoStudentSections'

const SECTIONS = [
  'overview',
  'curriculum',
  'grammar',
  'vocabulary',
  'speaking',
  'listening',
  'assignments',
  'notes',
  'history',
  'settings',
] as const
type Section = (typeof SECTIONS)[number]

const SECTION_LABEL: Record<Section, string> = {
  overview: 'Overview',
  curriculum: 'Curriculum',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  speaking: 'Speaking',
  listening: 'Listening',
  assignments: 'Assignments',
  notes: 'Teacher notes',
  history: 'History',
  settings: 'Settings',
}

/** Which milestone delivers each placeholder section (kept honest in the UI). */
const SECTION_MILESTONE: Record<Exclude<Section, 'overview' | 'history'>, string> = {
  curriculum: 'M3 · Curriculum and exercise engine',
  grammar: 'M5 · Student progress',
  vocabulary: 'M4 · Vocabulary and revision',
  speaking: 'M7 · AI speaking',
  listening: 'M8 · Advanced learning',
  assignments: 'M6 · Tutor dashboard',
  notes: 'M6 · Tutor dashboard',
  settings: 'M6 · Tutor dashboard',
}

const EVENT_LABEL: Record<AccountEvent['type'], string> = {
  owner_bootstrapped: 'Owner account bootstrapped',
  invitation_sent: 'Invitation sent',
  invitation_resent: 'Invitation re-sent',
  invitation_revoked: 'Invitation revoked',
  invitation_accepted: 'Invitation accepted',
  account_created: 'Account created',
  account_disabled: 'Access disabled',
  account_reactivated: 'Access reactivated',
  onboarding_completed: 'Onboarding completed',
}

function isSection(value: string | undefined): value is Section {
  return !!value && (SECTIONS as readonly string[]).includes(value)
}

export function StudentDetailPage() {
  const { studentId = '', section } = useParams()
  const navigate = useNavigate()
  const { state } = useAuth()
  const tutorId = state.status === 'authenticated' ? state.user.id : ''
  const preview = state.status === 'authenticated' && state.preview
  const student = useStudent(tutorId, studentId)
  const active: Section = isSection(section) ? section : 'overview'
  const demoProfile = preview ? findStudentProfile(studentId) : undefined

  if (student.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!student.data) {
    return (
      <EmptyState
        title="Student not found"
        description="This learner is not assigned to you or does not exist."
        action={
          <Button asChild variant="outline">
            <Link to="/tutor">Back to My Students</Link>
          </Button>
        }
      />
    )
  }

  const account = student.data

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/tutor">
          <ArrowLeft aria-hidden /> My Students
        </Link>
      </Button>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={account.fullName || account.email} size="xl" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{account.fullName || account.email}</h1>
            <p className="truncate text-sm text-fg-muted">{account.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant={account.status === 'disabled' ? 'danger' : account.status === 'active' ? 'success' : 'info'} data-testid="account-status">
                {ACCOUNT_STATUS_LABEL[account.status]}
              </Badge>
              {account.supportLanguage === 'az' ? (
                <Badge variant="outline">
                  <Languages aria-hidden /> AZ support
                </Badge>
              ) : null}
              <span className="text-xs text-fg-subtle">Joined {formatRelative(account.linkedAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AccountStatusDialog account={account} preview={preview} />
        </div>
      </header>

      <Tabs value={active} onValueChange={(value) => navigate(`/tutor/students/${studentId}/${value}`, { replace: true })}>
        <TabsList aria-label="Student profile sections" className="w-full justify-start sm:w-auto">
          {SECTIONS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {SECTION_LABEL[key]}
            </TabsTrigger>
          ))}
        </TabsList>

        {demoProfile ? (
          <DemoStudentSections profile={demoProfile} />
        ) : (
          <>
            <TabsContent value="overview">
              <AccountOverview account={account} />
            </TabsContent>
            <TabsContent value="history">
              <AccountHistory studentId={account.id} />
            </TabsContent>
            {(Object.keys(SECTION_MILESTONE) as (keyof typeof SECTION_MILESTONE)[]).map((key) => (
              <TabsContent key={key} value={key}>
                <EmptyState
                  title={`${SECTION_LABEL[key]} is not available yet`}
                  description={`This section shows real learning records once it ships (${SECTION_MILESTONE[key]}). Nothing is simulated here.`}
                />
              </TabsContent>
            ))}
          </>
        )}
      </Tabs>
    </div>
  )
}

function AccountOverview({ account }: { account: StudentAccount }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-fg-muted">Email</dt>
            <dd className="break-all">{account.email}</dd>
            <dt className="text-fg-muted">Status</dt>
            <dd>{ACCOUNT_STATUS_LABEL[account.status]}</dd>
            <dt className="text-fg-muted">Onboarding</dt>
            <dd>{account.onboardingCompletedAt ? `Completed ${formatRelative(account.onboardingCompletedAt)}` : 'Not completed yet'}</dd>
            <dt className="text-fg-muted">Support language</dt>
            <dd>{account.supportLanguage === 'az' ? 'Azerbaijani' : 'None'}</dd>
            <dt className="text-fg-muted">Linked</dt>
            <dd>{new Date(account.linkedAt).toLocaleString()}</dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Learning summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <DemoNotice>
            Level, progress, speaking minutes and homework appear here from M3–M6. No figures are shown until they are
            real.
          </DemoNotice>
        </CardContent>
      </Card>
    </div>
  )
}

function AccountHistory({ studentId }: { studentId: string }) {
  const events = useStudentEvents(studentId)
  if (events.isPending) return <Skeleton className="h-32 rounded-xl" />
  if (events.isError) return <EmptyState compact title="Could not load history" description={events.error.message} />
  if (!events.data.length) return <EmptyState compact title="No account events yet" />
  return (
    <Card>
      <CardContent>
        <ol className="flex flex-col divide-y divide-line">
          {events.data.map((event) => (
            <li key={event.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
                {event.type === 'account_disabled' ? <UserMinus className="size-3.5" aria-hidden /> : event.type === 'invitation_sent' || event.type === 'invitation_resent' ? <Mail className="size-3.5" aria-hidden /> : event.type === 'invitation_accepted' ? <UserPlus className="size-3.5" aria-hidden /> : <UserCheck className="size-3.5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{EVENT_LABEL[event.type]}</p>
                <p className="text-xs text-fg-subtle">{new Date(event.at).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function AccountStatusDialog({ account, preview }: { account: StudentAccount; preview: boolean }) {
  const admin = useStudentAdmin()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const disabled = account.status === 'disabled'
  const invited = account.status === 'invited'

  const confirm = async () => {
    setError(null)
    try {
      await admin.mutateAsync({ action: 'set_status', studentId: account.id, status: disabled ? 'active' : 'disabled' })
      setOpen(false)
    } catch (err) {
      setError(err instanceof StudentAdminError ? err.message : 'The request failed.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setError(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant={disabled ? 'secondary' : 'outline'} disabled={invited} data-testid="toggle-account-status">
          {disabled ? <CheckCircle2 aria-hidden /> : <Ban aria-hidden />}
          {disabled ? 'Reactivate' : 'Disable account'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{disabled ? 'Reactivate account?' : 'Disable account?'}</DialogTitle>
          <DialogDescription>
            {disabled
              ? 'The student will be able to sign in and continue learning.'
              : 'The student loses access immediately: existing sessions are blocked server-side and sign-in is refused until you reactivate. Their data is kept.'}
          </DialogDescription>
        </DialogHeader>
        {preview ? <DemoNotice>Preview mode: nothing is sent.</DemoNotice> : null}
        <FieldError>{error}</FieldError>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant={disabled ? 'primary' : 'danger'} onClick={() => void confirm()} loading={admin.isPending} disabled={preview} data-testid="confirm-account-status">
            {disabled ? 'Reactivate' : 'Disable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
