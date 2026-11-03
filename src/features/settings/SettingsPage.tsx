import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { DemoNotice } from '@/components/feedback/DemoNotice'
import { ThemeSegmentedControl } from '@/components/theme/ThemeToggle'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FEEDBACK_STYLES } from '@/demo/speaking'
import { useAuth } from '@/features/auth/AuthProvider'
import { NewPasswordForm } from '@/features/auth/NewPasswordForm'
import { useUpdateProfile } from '@/features/auth/profile-mutations'
import type { AuthUser } from '@/features/auth/types'
import { usePwaInstall } from '@/app/pwa'

export function SettingsPage() {
  const { state } = useAuth()
  const { canInstall, promptInstall, installed } = usePwaInstall()
  if (state.status !== 'authenticated') return null
  const { user, preview } = state

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Account" title="Settings" description="Profile, appearance, security and learning preferences." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProfileCard user={user} preview={preview} />

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Theme is stored on this device.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            <ThemeSegmentedControl />
            <div className="flex items-center justify-between gap-4 rounded-lg border border-line p-3">
              <div>
                <p className="text-sm font-medium">Install SpeakLab</p>
                <p className="text-xs text-fg-muted">
                  {installed
                    ? 'Installed on this device.'
                    : canInstall
                      ? 'Add to your home screen for a full-screen experience.'
                      : 'Use your browser menu (Share > Add to Home Screen on iOS) to install.'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={promptInstall} disabled={!canInstall}>
                Install
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Changing your password signs you in again automatically on this device.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {preview ? (
              <DemoNotice>Password changes are unavailable in preview mode.</DemoNotice>
            ) : (
              <PasswordCard />
            )}
          </CardContent>
        </Card>

        {user.role === 'student' ? <PreferencesCard user={user} preview={preview} /> : null}
      </div>
    </div>
  )
}

const profileSchema = z.object({ fullName: z.string().trim().min(2, 'Enter your name').max(120) })
type ProfileValues = z.infer<typeof profileSchema>

function ProfileCard({ user, preview }: { user: AuthUser; preview: boolean }) {
  const update = useUpdateProfile(user.id)
  const [saved, setSaved] = useState(false)
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: user.fullName } })

  const onSubmit = form.handleSubmit(async ({ fullName }) => {
    setSaved(false)
    try {
      await update.mutateAsync({ fullName })
      form.reset({ fullName })
      setSaved(true)
    } catch (error) {
      form.setError('root', { message: error instanceof Error ? error.message : 'Could not save.' })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your name is shown to your tutor.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="flex items-center gap-3">
          <Avatar name={user.fullName || user.email} size="lg" />
          <div>
            <p className="text-sm font-medium">{user.fullName || 'No name yet'}</p>
            <p className="text-xs text-fg-muted">{user.email}</p>
            <Badge variant="primary" className="mt-1 capitalize">
              {user.role}
            </Badge>
          </div>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field>
            <Label htmlFor="full-name">Full name</Label>
            <Input id="full-name" autoComplete="name" aria-invalid={!!form.formState.errors.fullName} {...form.register('fullName')} />
            <FieldError>{form.formState.errors.fullName?.message}</FieldError>
          </Field>
          <FieldError>{form.formState.errors.root?.message}</FieldError>
          <div className="flex items-center justify-between gap-2">
            {preview ? <DemoNotice>Preview mode: changes are not saved.</DemoNotice> : saved ? <p role="status" className="text-xs text-success">Saved</p> : <span />}
            <Button type="submit" disabled={preview || !form.formState.isDirty} loading={update.isPending}>
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const [done, setDone] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      {done ? (
        <p role="status" className="rounded-lg bg-success-soft p-3 text-sm text-success-soft-fg">
          Your password has been changed.
        </p>
      ) : null}
      <NewPasswordForm submitLabel="Change password" onSaved={() => setDone(true)} />
    </div>
  )
}

const preferencesSchema = z.object({
  supportLanguage: z.enum(['az', 'none']),
  feedbackStyle: z.string().min(1),
  dailySpeakingMinutes: z.number({ error: 'Enter a number' }).int().min(5, 'At least 5 minutes').max(120, 'At most 120 minutes'),
})
type PreferencesValues = z.infer<typeof preferencesSchema>

function PreferencesCard({ user, preview }: { user: AuthUser; preview: boolean }) {
  const update = useUpdateProfile(user.id)
  const [saved, setSaved] = useState(false)
  const form = useForm<PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      supportLanguage: user.supportLanguage,
      feedbackStyle: user.preferences.feedbackStyle,
      dailySpeakingMinutes: user.preferences.dailySpeakingMinutes,
    },
  })
  const supportLanguage = useWatch({ control: form.control, name: 'supportLanguage' })
  const feedbackStyle = useWatch({ control: form.control, name: 'feedbackStyle' })

  const onSubmit = form.handleSubmit(async (values) => {
    setSaved(false)
    try {
      await update.mutateAsync({
        supportLanguage: values.supportLanguage,
        preferences: {
          feedbackStyle: values.feedbackStyle,
          dailySpeakingMinutes: values.dailySpeakingMinutes,
          showSupportLanguage: values.supportLanguage === 'az',
        },
      })
      form.reset(values)
      setSaved(true)
    } catch (error) {
      form.setError('root', { message: error instanceof Error ? error.message : 'Could not save.' })
    }
  })

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Learning preferences</CardTitle>
        <CardDescription>How the coach and lessons behave for you. Saved to your account and applied on every device.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5 sm:grid-cols-2" noValidate>
          <div className="flex items-center justify-between gap-4 sm:col-span-2">
            <div>
              <Label htmlFor="az-support">Azerbaijani explanations</Label>
              <p className="text-xs text-fg-muted">Show grammar help and translations in Azerbaijani when you ask.</p>
            </div>
            <Switch
              id="az-support"
              checked={supportLanguage === 'az'}
              onCheckedChange={(checked) => form.setValue('supportLanguage', checked ? 'az' : 'none', { shouldDirty: true })}
            />
          </div>
          <Field>
            <Label htmlFor="feedback-pref">Coach feedback style</Label>
            <Select value={feedbackStyle} onValueChange={(value) => form.setValue('feedbackStyle', value, { shouldDirty: true })}>
              <SelectTrigger id="feedback-pref">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_STYLES.map((style) => (
                  <SelectItem key={style.id} value={style.id}>
                    {style.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Label htmlFor="daily-target">Daily speaking target (minutes)</Label>
            <Input id="daily-target" type="number" inputMode="numeric" min={5} max={120} {...form.register('dailySpeakingMinutes', { valueAsNumber: true })} />
            <FieldHint>Short, daily speaking beats long, rare sessions.</FieldHint>
            <FieldError>{form.formState.errors.dailySpeakingMinutes?.message}</FieldError>
          </Field>
          <FieldError className="sm:col-span-2">{form.formState.errors.root?.message}</FieldError>
          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            {preview ? <DemoNotice>Preview mode: changes are not saved.</DemoNotice> : saved ? <p role="status" className="text-xs text-success">Saved</p> : <span />}
            <Button type="submit" disabled={preview || !form.formState.isDirty} loading={update.isPending}>
              Save preferences
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
