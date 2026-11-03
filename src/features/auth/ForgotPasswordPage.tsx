import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldError, Label } from '@/components/ui/label'
import { env } from '@/config/env'

const schema = z.object({ email: z.email('Enter a valid email address') })
type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = form.handleSubmit(() => {
    // M2: resetPasswordForEmail via Supabase with the GitHub Pages redirect URL.
    form.setError('root', {
      message: 'Password recovery is not connected yet. It arrives with authentication in M2.',
    })
  })

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
          <Button type="submit" size="lg" className="w-full" disabled={!env.supabaseConfigured && !env.uiPreview}>
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
