import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label'
import { getSupabaseClient } from '@/lib/supabase/client'
import { describeAuthError } from './auth-errors'
import { newPasswordSchema, type NewPasswordValues } from './password'

interface NewPasswordFormProps {
  submitLabel?: string
  autoFocus?: boolean
  onSaved: () => void | Promise<void>
}

/** Sets the password of the *current* session via `auth.updateUser`. Used by onboarding, recovery and settings. */
export function NewPasswordForm({ submitLabel = 'Save password', autoFocus = false, onSaved }: NewPasswordFormProps) {
  const [busy, setBusy] = useState(false)
  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = form.handleSubmit(async ({ password }) => {
    const client = getSupabaseClient()
    if (!client) {
      form.setError('root', { message: 'Authentication is not configured in this build.' })
      return
    }
    setBusy(true)
    const { error } = await client.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      form.setError('root', { message: describeAuthError(error) })
      return
    }
    form.reset()
    await onSaved()
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate data-testid="new-password-form">
      <Field>
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          autoFocus={autoFocus}
          aria-invalid={!!form.formState.errors.password}
          {...form.register('password')}
        />
        <FieldHint>At least 10 characters with letters and numbers.</FieldHint>
        <FieldError>{form.formState.errors.password?.message}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="confirm-password">Confirm password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!form.formState.errors.confirm}
          {...form.register('confirm')}
        />
        <FieldError>{form.formState.errors.confirm?.message}</FieldError>
      </Field>
      <FieldError>{form.formState.errors.root?.message}</FieldError>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {submitLabel}
      </Button>
    </form>
  )
}
