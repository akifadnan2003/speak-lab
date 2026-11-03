import { expect, test, type Page } from '@playwright/test'

/**
 * Shell-level end-to-end checks against the production build served under
 * /speak-lab/ with VITE_UI_PREVIEW=true (see playwright.config.ts).
 */

const WIDTHS = [320, 375, 390, 430, 768, 1024, 1440]

async function setRole(page: Page, role: 'student' | 'tutor') {
  await page.goto('./#/')
  await page.evaluate((r) => sessionStorage.setItem('speaklab.preview.role', r), role)
  await page.reload()
}

test.describe('deployment basics', () => {
  test('serves the app under the project base path with a manifest and service worker', async ({ page, request }) => {
    await page.goto('./#/')
    await expect(page).toHaveTitle('SpeakLab')
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(manifestHref).toContain('/speak-lab/manifest.webmanifest')
    const manifest = await request.get(manifestHref!)
    expect(manifest.ok()).toBeTruthy()
    const json = await manifest.json()
    expect(json.start_url).toBe('/speak-lab/')
    expect(json.scope).toBe('/speak-lab/')
    expect(json.display).toBe('standalone')
    const sw = await request.get('/speak-lab/sw.js')
    expect(sw.ok()).toBeTruthy()
  })

  test('direct navigation and refresh survive on a deep hash route', async ({ page }) => {
    await setRole(page, 'student')
    await page.goto('./#/learn/a2-07')
    await expect(page.getByRole('heading', { name: /Past Continuous/ })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: /Past Continuous/ })).toBeVisible()
  })

  test('shows the preview banner so demo mode is explicit', async ({ page }) => {
    await setRole(page, 'student')
    await expect(page.getByTestId('preview-banner')).toContainText('Preview mode')
  })
})

test.describe('student navigation', () => {
  test('bottom nav / sidebar reach every student section', async ({ page }, testInfo) => {
    await setRole(page, 'student')
    const isMobile = testInfo.project.name.includes('mobile')
    const nav = isMobile ? page.getByTestId('bottom-nav') : page.getByTestId('desktop-sidebar')
    await expect(nav).toBeVisible()

    await nav.getByRole('link', { name: 'Learn', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your curriculum' })).toBeVisible()

    await nav.getByRole('link', { name: 'Speak', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'AI speaking coach' })).toBeVisible()

    await nav.getByRole('link', { name: /^Vocab(ulary)?$/ }).click()
    await expect(page.getByRole('heading', { name: 'Words and phrases' })).toBeVisible()

    await nav.getByRole('link', { name: 'Progress', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your learning record' })).toBeVisible()
  })

  test('lesson workspace sample exercise is keyboard operable', async ({ page }) => {
    await setRole(page, 'student')
    await page.goto('./#/learn/a2-07/lessons/a2-07-03')
    await expect(page.getByRole('heading', { name: 'Listening: a strange evening' })).toBeVisible()
    const option = page.getByRole('radio', { name: /was cooking/ })
    await option.focus()
    await page.keyboard.press('Enter')
    await expect(option).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: 'Check answer' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Correct!')).toBeVisible()
  })

  test('student cannot reach tutor routes', async ({ page }) => {
    await setRole(page, 'student')
    await page.goto('./#/tutor')
    await expect(page).toHaveURL(/#\/$/)
  })
})

test.describe('tutor dashboard', () => {
  test('student cards open the detailed profile and tabs are reachable', async ({ page }) => {
    await setRole(page, 'tutor')
    await expect(page.getByRole('heading', { name: 'My Students' })).toBeVisible()
    const cards = page.getByTestId('student-card')
    await expect(cards.first()).toBeVisible()
    await cards.first().click()
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: 'Grammar' }).click()
    await expect(page.getByRole('columnheader', { name: 'Recurring error' })).toBeVisible()
    await expect(page).toHaveURL(/\/grammar$/)
  })

  test('invite dialog opens, validates and closes with Escape', async ({ page }) => {
    await setRole(page, 'tutor')
    await page.getByTestId('invite-student').click()
    const dialog = page.getByRole('dialog', { name: 'Invite a student' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Send invitation' }).click()
    await expect(dialog.getByText('Enter a valid email address')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})

test.describe('theme', () => {
  test('theme toggle switches to dark and persists across reload', async ({ page }) => {
    await setRole(page, 'student')
    await page.getByTestId('theme-toggle').click()
    await page.getByRole('menuitemradio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})

test.describe('responsive layout has no horizontal overflow', () => {
  for (const width of WIDTHS) {
    test(`at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await setRole(page, 'student')
      for (const path of ['#/', '#/learn', '#/speak/roleplay', '#/vocabulary', '#/progress', '#/settings']) {
        await page.goto(`./${path}`)
        await page.waitForLoadState('networkidle')
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(0)
      }
      await setRole(page, 'tutor')
      for (const path of ['#/tutor', '#/tutor/students/st-aysel/grammar']) {
        await page.goto(`./${path}`)
        await page.waitForLoadState('networkidle')
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(0)
      }
    })
  }
})
