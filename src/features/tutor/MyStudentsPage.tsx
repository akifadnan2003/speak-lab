import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, ClipboardList, Mail, Mic, Search, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label'
import { PageHeader, SectionHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Stat } from '@/components/ui/stat'
import { DEMO_INVITATIONS, DEMO_STUDENTS, LEARNING_STATUS_LABEL, type DemoStudentCard, type LearningStatus } from '@/demo/students'
import { formatRelative } from '@/lib/utils'

const STATUS_VARIANT: Record<LearningStatus, 'success' | 'neutral' | 'warning' | 'info' | 'danger'> = {
  active: 'success',
  inactive: 'neutral',
  needs_attention: 'warning',
  invited: 'info',
  disabled: 'danger',
}

const inviteSchema = z.object({
  email: z.email('Enter a valid email address'),
  fullName: z.string().trim().min(2, 'Enter the student name').max(80),
})
type InviteValues = z.infer<typeof inviteSchema>

function InviteDialog() {
  const [open, setOpen] = useState(false)
  const form = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', fullName: '' } })
  const onSubmit = form.handleSubmit(() => {
    // M2: call the `invite-student` Edge Function (service role stays server-side).
    form.setError('root', { message: 'Invitations are sent by a secure Edge Function from milestone M2.' })
  })
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) form.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button data-testid="invite-student">
          <UserPlus aria-hidden /> Invite student
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a student</DialogTitle>
          <DialogDescription>
            The student receives a secure email link from Supabase. Links expire according to the
            provider settings and can be resent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate id="invite-form">
          <Field>
            <Label htmlFor="invite-name">Full name</Label>
            <Input id="invite-name" autoComplete="off" aria-invalid={!!form.formState.errors.fullName} {...form.register('fullName')} />
            <FieldError>{form.formState.errors.fullName?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              aria-invalid={!!form.formState.errors.email}
              {...form.register('email')}
            />
            <FieldHint>Only invited emails can create an account. There is no public sign-up.</FieldHint>
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </Field>
          <FieldError>{form.formState.errors.root?.message}</FieldError>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form">
            <Mail aria-hidden /> Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StudentCard({ student }: { student: DemoStudentCard }) {
  return (
    <li>
      <Link
        to={`/tutor/students/${student.id}`}
        className="group block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        data-testid="student-card"
      >
        <Card className="h-full transition-[box-shadow,border-color] group-hover:border-line-strong group-hover:shadow-md">
          <CardContent className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <Avatar name={student.fullName} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-base font-semibold">{student.fullName}</h3>
                  <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
                <p className="truncate text-xs text-fg-muted">{student.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="primary">{student.level}</Badge>
                  <Badge variant={STATUS_VARIANT[student.status]}>{LEARNING_STATUS_LABEL[student.status]}</Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-fg-muted">{student.currentChapter}</span>
                <span className="shrink-0 font-semibold tabular">{student.courseProgress}%</span>
              </div>
              <Progress value={student.courseProgress} size="sm" />
            </div>

            <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
              <div>
                <dt className="text-fg-subtle">Last active</dt>
                <dd className="font-medium">{formatRelative(student.lastActiveAt)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-fg-subtle">
                  <Mic className="size-3" aria-hidden /> Speaking
                </dt>
                <dd className="font-medium tabular">
                  {student.speakingSessionsThisWeek} · {student.speakingMinutesThisWeek}m
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-fg-subtle">
                  <ClipboardList className="size-3" aria-hidden /> Homework
                </dt>
                <dd className="font-medium tabular">
                  {student.pendingAssignments ? `${student.pendingAssignments} pending` : 'Up to date'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </Link>
    </li>
  )
}

export function MyStudentsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | LearningStatus>('all')

  const students = useMemo(() => {
    const q = query.trim().toLowerCase()
    return DEMO_STUDENTS.filter((s) => {
      if (status !== 'all' && s.status !== status) return false
      if (!q) return true
      return s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.level.toLowerCase() === q
    })
  }, [query, status])

  const active = DEMO_STUDENTS.filter((s) => s.status === 'active').length
  const attention = DEMO_STUDENTS.filter((s) => s.status === 'needs_attention').length
  const speakingMinutes = DEMO_STUDENTS.reduce((sum, s) => sum + s.speakingMinutesThisWeek, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Tutor dashboard"
        title="My Students"
        description="Open a card to see a learner's full profile, assign homework and leave notes."
        actions={
          <>
            <DemoNotice />
            <InviteDialog />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Students" value={DEMO_STUDENTS.length} hint={`${active} active`} />
        <Stat label="Need attention" value={attention} tone="warning" hint="Inactive 5+ days or overdue work" />
        <Stat label="Speaking this week" value={`${speakingMinutes} min`} tone="success" hint="All students" />
        <Stat label="Pending invitations" value={DEMO_INVITATIONS.filter((i) => i.status !== 'accepted').length} hint="See below" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input
            type="search"
            placeholder="Search by name, email or level"
            aria-label="Search students"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sm:w-52">
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(LEARNING_STATUS_LABEL) as LearningStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {LEARNING_STATUS_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {students.length ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={Search} title="No students match" description="Clear the search or change the status filter." />
      )}

      <Card>
        <CardHeader>
          <SectionHeader title="Invitations" description="Pending and expired invitations. Resend from here." />
        </CardHeader>
        <CardContent className="pt-0">
          {DEMO_INVITATIONS.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {DEMO_INVITATIONS.map((invite) => (
                <li key={invite.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-fg-muted">
                      Sent {formatRelative(invite.sentAt)} · expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={invite.status === 'expired' ? 'danger' : 'info'}>{invite.status}</Badge>
                    <Button variant="outline" size="sm" disabled>
                      Resend
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Mail} title="No pending invitations" compact />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
