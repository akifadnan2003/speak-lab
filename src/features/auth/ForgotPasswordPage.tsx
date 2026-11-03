import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldError, Label } from '@/components/ui/label'
import { env } from '@/config/env'
import { getSupabaseClient } from '@/lib/supabase/client'
import { describeAuthError } from './auth-errors'
import { appRedirectUrl } from './auth-url'

const schema = z.object({ email: z.email('Enter a valid email address') })
type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = form.handleSubmit(async ({ email }) => {
    const client = getSupabaseClient()
    if (!client) {
      form.setError('root', { message: 'Password recovery is not available: authentication is not configured in this build.' })
      return
    }
    setBusy(true)
    const normalised = email.trim().toLowerCase()
    const { error } = await client.auth.resetPasswordForEmail(normalised, { redirectTo: appRedirectUrl(env.basePath) })
    setBusy(false)
    if (error) {
      form.setError('root', { message: describeAuthError(error) })
      return
    }
    setSent(normalised)
  })

  if (sent) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-success-soft text-success-soft-fg">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            If an account exists for <strong>{sent}</strong>, a reset link is on its way. The link works once and expires
            soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">
              <ArrowLeft aria-hidden /> Back to sign in
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we will send a secure link to choose a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-invalid={!!form.formState.errors.email}
              {...form.register('email')}
            />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </Field>
          <FieldError>{form.formState.errors.root?.message}</FieldError>
          <Button type="submit" size="lg" className="w-full" disabled={!env.supabaseConfigured && !env.uiPreview} loading={busy}>
            Send reset link
          </Button>
        </form>
        <Button asChild variant="link" className="mt-4 w-full">
          <Link to="/login">
            <ArrowLeft aria-hidden /> Back to sign in
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
