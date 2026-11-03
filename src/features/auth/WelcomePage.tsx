import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FEEDBACK_STYLES } from '@/demo/speaking'
import { useAuth } from './AuthProvider'
import { homePathFor } from './guards'
import { NewPasswordForm } from './NewPasswordForm'
import { useCompleteOnboarding, useUpdateProfile } from './profile-mutations'

const preferencesSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(120),
  supportLanguage: z.enum(['az', 'none']),
  feedbackStyle: z.string().min(1),
  dailySpeakingMinutes: z.number({ error: 'Enter a number' }).int().min(5, 'At least 5 minutes').max(120, 'At most 120 minutes'),
})
type PreferencesValues = z.infer<typeof preferencesSchema>

type Step = 'password' | 'preferences'

/**
 * Invitation onboarding: the session was created by the verified invitation link; the student
 * now chooses a password and basic preferences, then onboarding is marked complete server-side.
 */
export function WelcomePage() {
  const { state, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('password')

  if (state.status !== 'authenticated') return <Navigate to="/login" replace />
  const { user } = state
  if (user.role !== 'student' || user.onboardingCompletedAt) return <Navigate to={homePathFor(user.role)} replace />

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex items-center justify-center gap-3 text-xs text-fg-muted" aria-label="Onboarding steps">
        <li className={step === 'password' ? 'font-semibold text-fg' : 'flex items-center gap-1 text-success'}>
          {step === 'preferences' ? <CheckCircle2 className="size-3.5" aria-hidden /> : null}1. Password
        </li>
        <li aria-hidden>·</li>
        <li className={step === 'preferences' ? 'font-semibold text-fg' : undefined}>2. Preferences</li>
      </ol>

      {step === 'password' ? (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">Welcome to SpeakLab</CardTitle>
            <CardDescription>
              Your invitation for <strong>{user.email}</strong> is verified. Choose a password so you can sign in on any
              device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewPasswordForm submitLabel="Continue" autoFocus onSaved={() => setStep('preferences')} />
          </CardContent>
        </Card>
      ) : (
        <PreferencesStep
          userId={user.id}
          defaults={{
            fullName: user.fullName,
            supportLanguage: user.supportLanguage,
            feedbackStyle: user.preferences.feedbackStyle,
            dailySpeakingMinutes: user.preferences.dailySpeakingMinutes,
          }}
          onDone={async () => {
            await refreshProfile()
            navigate('/', { replace: true })
          }}
        />
      )}
    </div>
  )
}

function PreferencesStep({
  userId,
  defaults,
  onDone,
}: {
  userId: string
  defaults: PreferencesValues
  onDone: () => Promise<void>
}) {
  const update = useUpdateProfile(userId)
  const complete = useCompleteOnboarding()
  const form = useForm<PreferencesValues>({ resolver: zodResolver(preferencesSchema), defaultValues: defaults })
  const supportLanguage = useWatch({ control: form.control, name: 'supportLanguage' })
  const feedbackStyle = useWatch({ control: form.control, name: 'feedbackStyle' })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        fullName: values.fullName,
        supportLanguage: values.supportLanguage,
        preferences: {
          feedbackStyle: values.feedbackStyle,
          dailySpeakingMinutes: values.dailySpeakingMinutes,
          showSupportLanguage: values.supportLanguage === 'az',
        },
      })
      await complete.mutateAsync()
      await onDone()
    } catch (error) {
      form.setError('root', { message: error instanceof Error ? error.message : 'Could not save your preferences.' })
    }
  })

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">A few preferences</CardTitle>
        <CardDescription>You can change all of this later in Settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate data-testid="preferences-form">
          <Field>
            <Label htmlFor="full-name">Your name</Label>
            <Input id="full-name" autoComplete="name" aria-invalid={!!form.formState.errors.fullName} {...form.register('fullName')} />
            <FieldHint>Shown to your tutor.</FieldHint>
            <FieldError>{form.formState.errors.fullName?.message}</FieldError>
          </Field>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="support-language">Azerbaijani explanations</Label>
              <p className="text-xs text-fg-muted">Grammar help and translations in Azerbaijani when you ask.</p>
            </div>
            <Switch
              id="support-language"
              checked={supportLanguage === 'az'}
              onCheckedChange={(checked) => form.setValue('supportLanguage', checked ? 'az' : 'none', { shouldDirty: true })}
            />
          </div>
          <Field>
            <Label htmlFor="feedback-style">Coach feedback style</Label>
            <Select value={feedbackStyle} onValueChange={(value) => form.setValue('feedbackStyle', value, { shouldDirty: true })}>
              <SelectTrigger id="feedback-style">
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
            <FieldError>{form.formState.errors.dailySpeakingMinutes?.message}</FieldError>
          </Field>
          <FieldError>{form.formState.errors.root?.message}</FieldError>
          <Button type="submit" size="lg" className="w-full" loading={update.isPending || complete.isPending}>
            Start learning
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
