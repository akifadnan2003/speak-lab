import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, Languages, Mail, RefreshCw, Search, UserPlus, XCircle } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Stat } from '@/components/ui/stat'
import { useAuth } from '@/features/auth/AuthProvider'
import type { AccountStatus } from '@/features/auth/types'
import { formatRelative } from '@/lib/utils'
import { ACCOUNT_STATUS_LABEL, StudentAdminError, useInvitations, useStudentAdmin, useStudents, type Invitation, type InvitationDisplayStatus, type StudentAccount } from './api'

const ACCOUNT_STATUS_VARIANT: Record<AccountStatus, 'success' | 'info' | 'danger'> = {
  invited: 'info',
  active: 'success',
  disabled: 'danger',
}
const INVITE_STATUS_VARIANT: Record<InvitationDisplayStatus, 'info' | 'danger' | 'success' | 'neutral'> = {
  pending: 'info',
  expired: 'danger',
  accepted: 'success',
  revoked: 'neutral',
}

const inviteSchema = z.object({
  email: z.email('Enter a valid email address'),
  fullName: z.string().trim().min(2, 'Enter the student name').max(120),
})
type InviteValues = z.infer<typeof inviteSchema>

function InviteDialog({ onInvited }: { onInvited: (email: string) => void }) {
  const [open, setOpen] = useState(false)
  const admin = useStudentAdmin()
  const form = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', fullName: '' } })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await admin.mutateAsync({ action: 'invite', email: values.email.trim().toLowerCase(), fullName: values.fullName })
      setOpen(false)
      form.reset()
      onInvited(values.email.trim().toLowerCase())
    } catch (error) {
      form.setError('root', { message: error instanceof StudentAdminError ? error.message : 'Invitation could not be sent.' })
    }
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
            The student receives a secure email link. Links work once and expire after a short time; you can resend
            from the invitations list.
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
          <FieldError data-testid="invite-error">{form.formState.errors.root?.message}</FieldError>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" loading={admin.isPending}>
            <Mail aria-hidden /> Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StudentCard({ student }: { student: StudentAccount }) {
  const settingUp = student.status === 'active' && !student.onboardingCompletedAt
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
              <Avatar name={student.fullName || student.email} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-base font-semibold">{student.fullName || student.email}</h3>
                  <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
                <p className="truncate text-xs text-fg-muted">{student.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant={ACCOUNT_STATUS_VARIANT[student.status]}>{ACCOUNT_STATUS_LABEL[student.status]}</Badge>
                  {settingUp ? <Badge variant="warning">Setting up</Badge> : null}
                  {student.supportLanguage === 'az' ? (
                    <Badge variant="outline">
                      <Languages aria-hidden /> AZ support
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
              <div>
                <dt className="text-fg-subtle">Joined</dt>
                <dd className="font-medium">{formatRelative(student.linkedAt)}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Level</dt>
                <dd className="font-medium text-fg-muted">Not placed yet</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </Link>
    </li>
  )
}

function InvitationRowItem({ invite, onMessage }: { invite: Invitation; onMessage: (text: string, tone: 'success' | 'danger') => void }) {
  const admin = useStudentAdmin()
  const [pendingAction, setPendingAction] = useState<'resend' | 'revoke' | null>(null)
  const run = async (action: 'resend' | 'revoke') => {
    setPendingAction(action)
    try {
      await admin.mutateAsync({ action, invitationId: invite.id })
      onMessage(action === 'resend' ? `Invitation re-sent to ${invite.email}.` : `Invitation for ${invite.email} revoked.`, 'success')
    } catch (error) {
      onMessage(error instanceof StudentAdminError ? error.message : 'The request failed.', 'danger')
    } finally {
      setPendingAction(null)
    }
  }
  const open = invite.status === 'pending' || invite.status === 'expired'
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" data-testid="invitation-row">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {invite.fullName ? `${invite.fullName} · ` : ''}
          {invite.email}
        </p>
        <p className="text-xs text-fg-muted">
          Sent {formatRelative(invite.sentAt)}
          {invite.status === 'pending' ? ` · expires ${new Date(invite.expiresAt).toLocaleString()}` : ''}
          {invite.status === 'accepted' && invite.acceptedAt ? ` · accepted ${formatRelative(invite.acceptedAt)}` : ''}
          {invite.resendCount ? ` · resent ${invite.resendCount}×` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={INVITE_STATUS_VARIANT[invite.status]} className="capitalize">
          {invite.status}
        </Badge>
        {open ? (
          <>
            <Button variant="outline" size="sm" onClick={() => void run('resend')} loading={pendingAction === 'resend'} disabled={admin.isPending}>
              <RefreshCw aria-hidden /> Resend
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void run('revoke')} loading={pendingAction === 'revoke'} disabled={admin.isPending}>
              <XCircle aria-hidden /> Revoke
            </Button>
          </>
        ) : null}
      </div>
    </li>
  )
}

export function MyStudentsPage() {
  const { state } = useAuth()
  const tutorId = state.status === 'authenticated' ? state.user.id : ''
  const preview = state.status === 'authenticated' && state.preview
  const students = useStudents(tutorId)
  const invitations = useInvitations(tutorId)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | AccountStatus>('all')
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null)

  const list = useMemo(() => students.data ?? [], [students.data])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((s) => {
      if (status !== 'all' && s.status !== status) return false
      if (!q) return true
      return s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    })
  }, [list, query, status])

  const active = list.filter((s) => s.status === 'active').length
  const disabled = list.filter((s) => s.status === 'disabled').length
  const openInvites = (invitations.data ?? []).filter((i) => i.status === 'pending' || i.status === 'expired').length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Tutor dashboard"
        title="My Students"
        description="Invite learners, manage their access and open a card for details."
        actions={
          <>
            {preview ? <DemoNotice /> : null}
            <InviteDialog onInvited={(email) => setMessage({ text: `Invitation sent to ${email}.`, tone: 'success' })} />
          </>
        }
      />

      {message ? (
        <p
          role="status"
          data-testid="tutor-message"
          className={
            message.tone === 'success'
              ? 'rounded-lg bg-success-soft px-3 py-2 text-sm text-success-soft-fg'
              : 'rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg'
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Students" value={list.length} hint={`${active} active`} />
        <Stat label="Disabled" value={disabled} tone={disabled ? 'warning' : 'default'} hint="Access paused" />
        <Stat label="Open invitations" value={openInvites} hint="Pending or expired" />
        <Stat label="Speaking this week" value="—" hint="Available from M5" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input
            type="search"
            placeholder="Search by name or email"
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
              {(Object.keys(ACCOUNT_STATUS_LABEL) as AccountStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {ACCOUNT_STATUS_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {students.isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : students.isError ? (
        <EmptyState title="Could not load students" description={students.error.message} action={<Button variant="outline" onClick={() => void students.refetch()}>Retry</Button>} />
      ) : filtered.length ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </ul>
      ) : list.length ? (
        <EmptyState icon={Search} title="No students match" description="Clear the search or change the status filter." />
      ) : (
        <EmptyState icon={UserPlus} title="No students yet" description="Send your first invitation. The student appears here after accepting it." />
      )}

      <Card>
        <CardHeader>
          <SectionHeader title="Invitations" description="Every invitation you have sent. Resend or revoke open ones." />
        </CardHeader>
        <CardContent className="pt-0">
          {invitations.isPending ? (
            <Skeleton className="h-12 rounded-lg" />
          ) : invitations.isError ? (
            <EmptyState compact title="Could not load invitations" description={invitations.error.message} />
          ) : invitations.data.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {invitations.data.map((invite) => (
                <InvitationRowItem key={invite.id} invite={invite} onMessage={(text, tone) => setMessage({ text, tone })} />
              ))}
            </ul>
          ) : (
            <EmptyState icon={Mail} title="No invitations yet" compact />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
