import { describe, expect, it } from 'vitest'
import { bottomNavFor, navFor, STUDENT_NAV, TUTOR_NAV } from './nav'

describe('navigation config', () => {
  it('gives students the learning sections and tutors the teaching sections', () => {
    expect(navFor('student')).toBe(STUDENT_NAV)
    expect(navFor('tutor')).toBe(TUTOR_NAV)
    expect(STUDENT_NAV.map((i) => i.to)).toEqual(['/', '/learn', '/homework', '/speak', '/vocabulary', '/progress'])
    expect(TUTOR_NAV[0]?.to).toBe('/tutor')
  })

  it('never puts more than five items in the mobile bottom bar', () => {
    expect(bottomNavFor('student').length).toBeLessThanOrEqual(5)
    // Homework is reached from the home card and the drawer; the bottom bar keeps the five core sections.
    expect(bottomNavFor('student').map((i) => i.to)).toEqual(['/', '/learn', '/speak', '/vocabulary', '/progress'])
    expect(bottomNavFor('tutor').length).toBeLessThanOrEqual(5)
  })

  it('does not expose tutor routes to students', () => {
    expect(bottomNavFor('student').some((i) => i.to.startsWith('/tutor'))).toBe(false)
  })
})
