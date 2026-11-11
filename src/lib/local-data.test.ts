import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activateLocalUser, clearLocalStudentData, deactivateLocalUser, registerLocalDataCleaner } from './local-data'

describe('clearLocalStudentData', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('removes speaklab.* student keys but keeps the theme and the auth session storage', async () => {
    localStorage.setItem('speaklab.progress.lesson-1', '{"score":90}')
    localStorage.setItem('speaklab.assessment.retakes', '2')
    localStorage.setItem('speaklab.theme', 'dark')
    localStorage.setItem('speaklab.auth', '{"access_token":"x"}')
    localStorage.setItem('other-app', 'keep')
    sessionStorage.setItem('speaklab.preview.role', 'tutor')

    const removed = await clearLocalStudentData()

    expect(removed.sort()).toEqual(['speaklab.assessment.retakes', 'speaklab.preview.role', 'speaklab.progress.lesson-1'])
    expect(localStorage.getItem('speaklab.theme')).toBe('dark')
    expect(localStorage.getItem('speaklab.auth')).toContain('access_token')
    expect(localStorage.getItem('other-app')).toBe('keep')
    expect(sessionStorage.getItem('speaklab.preview.role')).toBeNull()
  })

  it('runs registered feature cleaners (e.g. M3 clearStoredProgress) and tolerates failures', async () => {
    const ok = vi.fn()
    const bad = vi.fn(() => {
      throw new Error('boom')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unregister = registerLocalDataCleaner(ok)
    const unregisterBad = registerLocalDataCleaner(bad)
    await clearLocalStudentData()
    expect(ok).toHaveBeenCalledTimes(1)
    expect(bad).toHaveBeenCalledTimes(1)
    unregister()
    unregisterBad()
    await clearLocalStudentData()
    expect(ok).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

describe('activateLocalUser (shared devices)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('does not purge on the first sign-in or when the same user returns', async () => {
    localStorage.setItem('speaklab.progress.x', '1')
    expect(await activateLocalUser('user-a')).toBe(false)
    expect(localStorage.getItem('speaklab.progress.x')).toBe('1')
    expect(await activateLocalUser('user-a')).toBe(false)
    expect(localStorage.getItem('speaklab.progress.x')).toBe('1')
  })

  it('purges the previous student’s data when a different account signs in', async () => {
    await activateLocalUser('user-a')
    localStorage.setItem('speaklab.progress.x', 'a-data')
    const cleaner = vi.fn()
    const unregister = registerLocalDataCleaner(cleaner)
    expect(await activateLocalUser('user-b')).toBe(true)
    expect(localStorage.getItem('speaklab.progress.x')).toBeNull()
    expect(localStorage.getItem('speaklab.active-user')).toBe('user-b')
    expect(cleaner).toHaveBeenCalled()
    unregister()
  })

  it('forgets the marker on sign-out so the next sign-in starts clean', async () => {
    await activateLocalUser('user-a')
    deactivateLocalUser()
    expect(localStorage.getItem('speaklab.active-user')).toBeNull()
  })
})
