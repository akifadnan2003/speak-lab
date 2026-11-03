import { z } from 'zod'

/** Mirrors the Supabase project policy: 10+ characters with letters and digits. */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Use at most 72 characters')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include both letters and numbers')

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

export type NewPasswordValues = z.infer<typeof newPasswordSchema>
