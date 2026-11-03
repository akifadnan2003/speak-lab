import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { adminClient, extractAuthLink, mailpitDelete, STUDENT_PASSWORD, TUTOR_PASSWORD, uniqueEmail, waitForEmail } from '../supabase/tests/helpers.ts'
import { TUTOR_STATE_FILE } from './auth.setup.ts'

/**
 * Real authentication flows through the production bundle served under /speak-lab/ against the
 * local Supabase stack. Emails are real GoTrue emails read from Mailpit; links are opened as
 * delivered (query string before the hash), exactly as on GitHub Pages.
 */

const tutor = JSON.parse(readFileSync(TUTOR_STATE_FILE, 'utf8')) as { id: string; email: string }
const admin = adminClient()
const createdUsers: string[] = []

test.afterAll(async () => {
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id)
})

async function login(page: Page, email: string, password: string) {
  await page.goto('./#/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function logout(page: Page) {
  await page.getByTestId('user-menu').click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/#\/login$/)
}

/** Turns an absolute emailed link into a path relative to the Playwright baseURL. */
function relativeLink(link: URL): string {
  return `./${link.search}${link.hash}`
}

test.describe.configure({ mode: 'serial' })

test('14 + 15 · unauthenticated deep links fail closed and the login screen survives refresh', async ({ page }) => {
  await page.goto('./#/tutor/students/anyone/notes')
  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByTestId('auth-unconfigured')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})

test('login rejects wrong credentials with a clear message', async ({ page }) => {
  await login(page, tutor.email, 'definitely-wrong-password')
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
})

test('tutor invites a student; the student accepts the emailed link, sets a password and preferences, and lands on the dashboard', async ({ page, browser }) => {
  test.setTimeout(180_000)
  const email = uniqueEmail('e2e-student')

  await login(page, tutor.email, TUTOR_PASSWORD)
  await expect(page).toHaveURL(/#\/tutor$/)
  await expect(page.getByRole('heading', { name: 'My Students' })).toBeVisible()

  await page.getByTestId('invite-student').click()
  const dialog = page.getByRole('dialog', { name: 'Invite a student' })
  await dialog.getByLabel('Full name').fill('Leyla Test')
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByTestId('tutor-message')).toContainText(`Invitation sent to ${email}`)
  await expect(page.getByTestId('invitation-row').filter({ hasText: email })).toContainText('pending')

  // A duplicate invitation is refused with a meaningful error.
  await page.getByTestId('invite-student').click()
  await dialog.getByLabel('Full name').fill('Leyla Test')
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByTestId('invite-error')).toContainText('pending invitation')
  await page.keyboard.press('Escape')

  // The student opens the real emailed link in a fresh browser context (another device).
  const mail = await waitForEmail(email)
  const link = extractAuthLink(mail.html, mail.text)
  expect(link.searchParams.get('type')).toBe('invite')
  await mailpitDelete([mail.id])

  const studentContext = await browser.newContext()
  const student = await studentContext.newPage()
  await student.goto(relativeLink(link))
  // Secrets are removed from the address bar before anything renders.
  await expect(student).toHaveURL(/\/speak-lab\/#\/auth\/callback\?flow=invite$/)
  await expect(student).toHaveURL(/#\/welcome$/, { timeout: 30_000 })
  expect(student.url()).not.toContain('token_hash')

  await student.getByLabel('New password').fill(STUDENT_PASSWORD)
  await student.getByLabel('Confirm password').fill(STUDENT_PASSWORD)
  await student.getByRole('button', { name: 'Continue' }).click()

  await expect(student.getByRole('heading', { name: 'A few preferences' })).toBeVisible()
  await student.getByLabel('Your name').fill('Leyla Test')
  await student.getByLabel('Daily speaking target (minutes)').fill('20')
  await student.getByRole('button', { name: 'Start learning' }).click()
  await expect(student).toHaveURL(/#\/$/)
  await expect(student.getByText(/recommended lesson/i)).toBeVisible()

  // Refreshing a protected route keeps the session.
  await student.goto('./#/settings')
  await student.reload()
  await expect(student.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(student.getByLabel('Daily speaking target (minutes)')).toHaveValue('20')

  // Students never reach tutor routes, even by typing the URL.
  await student.goto('./#/tutor')
  await expect(student).toHaveURL(/#\/$/)
  await student.goto(`./#/tutor/students/${tutor.id}/notes`)
  await expect(student).toHaveURL(/#\/$/)

  // Logout removes access; login from "another device" restores identity and preferences.
  await logout(student)
  await student.goto('./#/settings')
  await expect(student).toHaveURL(/#\/login$/)
  await studentContext.close()

  const secondDevice = await browser.newContext()
  const again = await secondDevice.newPage()
  await login(again, email, STUDENT_PASSWORD)
  await expect(again).toHaveURL(/#\/$/)
  await again.goto('./#/settings')
  await expect(again.getByLabel('Full name')).toHaveValue('Leyla Test')
  await expect(again.getByLabel('Daily speaking target (minutes)')).toHaveValue('20')
  await secondDevice.close()

  // The tutor now sees the real student card with real account data.
  await page.reload()
  const card = page.getByTestId('student-card').filter({ hasText: email })
  await expect(card).toContainText('Leyla Test')
  await expect(card).toContainText('Active')
  await expect(page.getByTestId('invitation-row').filter({ hasText: email })).toContainText('accepted')

  const profile = await admin.from('profiles').select('id').eq('email', email).single()
  createdUsers.push(profile.data!.id as string)
})

test('tutor disables a student: the live session is blocked and sign-in refused until reactivation', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const email = uniqueEmail('e2e-disable')
  const created = await admin.auth.admin.createUser({ email, password: STUDENT_PASSWORD, email_confirm: true, user_metadata: { full_name: 'Nigar Test' } })
  createdUsers.push(created.data.user!.id)
  await admin.from('tutor_students').insert({ tutor_id: tutor.id, student_id: created.data.user!.id })
  await admin.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', created.data.user!.id)

  const studentContext = await browser.newContext()
  const student = await studentContext.newPage()
  await login(student, email, STUDENT_PASSWORD)
  await expect(student).toHaveURL(/#\/$/)

  await login(page, tutor.email, TUTOR_PASSWORD)
  await page.getByTestId('student-card').filter({ hasText: email }).click()
  await expect(page.getByTestId('account-status')).toHaveText('Active')
  await page.getByTestId('toggle-account-status').click()
  await page.getByTestId('confirm-account-status').click()
  await expect(page.getByTestId('account-status')).toHaveText('Disabled')

  // The student's open session is pushed to the disabled screen on the next profile check.
  await student.reload()
  await expect(student).toHaveURL(/#\/account-disabled$/, { timeout: 30_000 })
  await student.getByRole('button', { name: 'Back to sign in' }).click()
  await login(student, email, STUDENT_PASSWORD)
  await expect(student.getByRole('alert')).toContainText('disabled')

  await page.getByTestId('toggle-account-status').click()
  await page.getByTestId('confirm-account-status').click()
  await expect(page.getByTestId('account-status')).toHaveText('Active')
  await login(student, email, STUDENT_PASSWORD)
  await expect(student).toHaveURL(/#\/$/)
  await studentContext.close()
})

test('password recovery through the emailed link', async ({ page }) => {
  test.setTimeout(120_000)
  const email = uniqueEmail('e2e-recovery')
  const created = await admin.auth.admin.createUser({ email, password: STUDENT_PASSWORD, email_confirm: true, user_metadata: { full_name: 'Kamran Test' } })
  createdUsers.push(created.data.user!.id)
  await admin.from('tutor_students').insert({ tutor_id: tutor.id, student_id: created.data.user!.id })
  await admin.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', created.data.user!.id)

  await page.goto('./#/forgot-password')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  const mail = await waitForEmail(email)
  const link = extractAuthLink(mail.html, mail.text)
  expect(link.searchParams.get('type')).toBe('recovery')
  await mailpitDelete([mail.id])

  await page.goto(relativeLink(link))
  await expect(page).toHaveURL(/#\/reset-password$/, { timeout: 30_000 })
  const newPassword = 'Recovered-pass-2026'
  await page.getByLabel('New password').fill(newPassword)
  await page.getByLabel('Confirm password').fill(newPassword)
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page).toHaveURL(/#\/$/)

  await logout(page)
  await login(page, email, STUDENT_PASSWORD)
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
  await login(page, email, newPassword)
  await expect(page).toHaveURL(/#\/$/)

  // A used link cannot be replayed.
  await logout(page)
  await page.goto(relativeLink(link))
  await expect(page.getByTestId('auth-callback-error')).toBeVisible({ timeout: 30_000 })
})
