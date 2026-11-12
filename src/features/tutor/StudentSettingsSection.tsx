import { Ban, CheckCircle2, Languages, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useChapterOverrideMutations, useProgression } from '@/features/curriculum/CurriculumProvider'
import { currentChapter } from '@/features/curriculum/progression'
import { CEFR_LEVELS, LEVEL_NAMES, type CefrLevel } from '@/features/curriculum/schema'
import { ACCOUNT_STATUS_LABEL, StudentAdminError, useStudentAdmin, type StudentAccount } from './api'

/**
 * What the tutor can and cannot change about a student.
 *
 * Student-owned (read-only here, enforced by column grants on `profiles`): name, Azerbaijani
 * support, feedback style, daily speaking target. Tutor-owned: access status (through the
 * `student-admin` Edge Function) and placement (chapter overrides, audited). AI settings are
 * deferred to M7 and deliberately not shown as controls.
 */
export function StudentSettingsSection({ account, tutorId }: { account: StudentAccount; tutorId: string }) {
  const admin = useStudentAdmin()
  const { states, chapters } = useProgression(account.id)
  const overrides = useChapterOverrideMutations(account.id, tutorId)
  const [confirmStatus, setConfirmStatus] = useState(false)
  const disabled = account.status === 'disabled'
  const current = states ? currentChapter(states) : undefined
  const prefs = account.preferences
  const dailyMinutes = typeof prefs.dailySpeakingMinutes === 'number' ? prefs.dailySpeakingMinutes : null
  const feedbackStyle = typeof prefs.feedbackStyle === 'string' ? prefs.feedbackStyle : null

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="student-settings">
      <Card>
        <CardHeader>
          <CardTitle>Student-owned preferences</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-fg-muted">Name</dt>
            <dd>{account.fullName || 'Not set'}</dd>
            <dt className="text-fg-muted">Azerbaijani help</dt>
            <dd className="inline-flex items-center gap-1.5">
              <Languages className="size-4 text-fg-muted" aria-hidden /> {account.supportLanguage === 'az' ? 'Shown on request in lessons' : 'Turned off by the student'}
            </dd>
            <dt className="text-fg-muted">Daily speaking target</dt>
            <dd>{dailyMinutes !== null ? `${dailyMinutes} minutes` : 'Not set'}</dd>
            <dt className="text-fg-muted">Feedback style</dt>
            <dd>{feedbackStyle ?? 'Not set'} (used by the AI coach from M7)</dd>
          </dl>
          <p className="text-xs text-fg-muted">
            These belong to the student and are changed in their own Settings. The database only lets the student write them, so this page shows them without editing controls.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Placement</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <p className="text-sm text-fg-muted">
            Currently on <span className="font-medium text-fg">{current ? `${current.chapter.level} · ${current.chapter.title}` : 'no open written chapter'}</span>.
          </p>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg-muted">Start the student at a level (skips every chapter below it; audited)</span>
            <select
              aria-label="Place the student at a level"
              className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-base sm:h-10 sm:text-sm"
              disabled={overrides.placeAtLevel.isPending || !states}
              value=""
              onChange={(event) => {
                const level = event.target.value as CefrLevel | ''
                if (!level || !states) return
                overrides.placeAtLevel.mutate({ level, levels: CEFR_LEVELS, chapters: [...states.values()].map((s) => ({ id: s.chapter.id, level: s.chapter.level })) })
              }}
              data-testid="settings-place-at-level"
            >
              <option value="">Choose a level…</option>
              {CEFR_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level} · {LEVEL_NAMES[level]}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-fg-muted">Individual chapters are unlocked or skipped on the Curriculum tab. Only {chapters?.filter((c) => c.status === 'authored').length ?? 0} chapters are written so far.</p>
          {overrides.placeAtLevel.isError ? (
            <p role="alert" className="text-sm text-danger">
              {overrides.placeAtLevel.error.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account access</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <p className="inline-flex items-center gap-1.5 text-sm">
            <ShieldCheck className="size-4 text-fg-muted" aria-hidden /> {ACCOUNT_STATUS_LABEL[account.status]}
          </p>
          <p className="text-xs text-fg-muted">
            Disabling blocks sign-in and every read or write immediately (server-side), without deleting anything. Reactivate at any time.
          </p>
          <Button variant={disabled ? 'primary' : 'outline'} className="w-fit" onClick={() => setConfirmStatus(true)} disabled={admin.isPending || account.status === 'invited'} data-testid="settings-toggle-access">
            {disabled ? (
              <>
                <CheckCircle2 aria-hidden /> Reactivate access
              </>
            ) : (
              <>
                <Ban aria-hidden /> Disable access
              </>
            )}
          </Button>
          {admin.isError ? (
            <p role="alert" className="text-sm text-danger">
              {admin.error instanceof StudentAdminError ? admin.error.message : 'The change failed.'}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI coach settings</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-fg-muted">Feedback style, daily AI minutes, usage and cost controls arrive with the AI speaking coach (M7). No control is shown here until it does something.</p>
        </CardContent>
      </Card>

      <Dialog open={confirmStatus} onOpenChange={setConfirmStatus}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{disabled ? 'Reactivate access?' : 'Disable access?'}</DialogTitle>
            <DialogDescription>
              {disabled ? `${account.fullName || account.email} will be able to sign in and continue where they left off.` : `${account.fullName || account.email} will be signed out and blocked until you reactivate the account. Nothing is deleted.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant={disabled ? 'primary' : 'danger'}
              loading={admin.isPending}
              onClick={async () => {
                await admin.mutateAsync({ action: 'set_status', studentId: account.id, status: disabled ? 'active' : 'disabled' }).catch(() => undefined)
                setConfirmStatus(false)
              }}
              data-testid="settings-confirm-access"
            >
              {disabled ? 'Reactivate' : 'Disable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
