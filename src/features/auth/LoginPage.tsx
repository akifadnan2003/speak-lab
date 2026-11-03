import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldError, Label } from '@/components/ui/label'
import { env } from '@/config/env'
import { getSupabaseClient } from '@/lib/supabase/client'
import { describeAuthError } from './auth-errors'
import { useAuth } from './AuthProvider'

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { state } = useAuth()
  const location = useLocation()
  const unconfigured = state.status === 'unauthenticated' && state.reason === 'unconfigured'
  const canSubmit = env.supabaseConfigured
  const [busy, setBusy] = useState(false)
  const notice = (location.state as { notice?: string } | null)?.notice

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    const client = getSupabaseClient()
    if (!client) {
      form.setError('root', { message: 'Sign-in is not available: authentication is not configured in this build.' })
      return
    }
    setBusy(true)
    const { error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    setBusy(false)
    if (error) {
      form.setError('root', { message: describeAuthError(error) })
      form.resetField('password')
      return
    }
    // The auth listener updates the context; <RedirectIfAuthenticated> then sends the user home.
  })

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in with the account your tutor created for you.</CardDescription>
      </CardHeader>
      <CardContent>
        {unconfigured ? (
          <div
            role="status"
            data-testid="auth-unconfigured"
            className="mb-5 flex gap-3 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning-soft-fg"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Authentication is not configured in this build. Protected areas stay locked until the
              Supabase project is connected.
            </p>
          </div>
        ) : null}
        {notice ? (
          <p role="status" className="mb-5 rounded-lg bg-success-soft p-3 text-sm text-success-soft-fg">
            {notice}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              aria-invalid={!!form.formState.errors.email}
              {...form.register('email')}
            />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!form.formState.errors.password}
              {...form.register('password')}
            />
            <FieldError>{form.formState.errors.password?.message}</FieldError>
          </Field>
          <FieldError>{form.formState.errors.root?.message}</FieldError>
          <Button type="submit" size="lg" className="mt-1 w-full" disabled={!canSubmit && !env.uiPreview} loading={busy}>
            Sign in
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-fg-muted">
          There is no public sign-up. Accounts are created by invitation only.
        </p>
      </CardContent>
    </Card>
  )
}
