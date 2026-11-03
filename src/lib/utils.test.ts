import { describe, expect, it } from 'vitest'
import { clamp, cn, formatMinutes, formatRelative, greetingFor, initials } from './utils'

describe('cn', () => {
  it('merges conflicting tailwind classes, last wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })
})

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Aysel Mammadova')).toBe('AM')
  })
  it('handles single names and extra whitespace', () => {
    expect(initials('  rashad  ')).toBe('R')
  })
  it('ignores punctuation-only words such as "(preview)"', () => {
    expect(initials('Aysel (Student preview)')).toBe('AS')
  })
  it('returns empty string for empty input', () => {
    expect(initials('')).toBe('')
  })
})

describe('clamp', () => {
  it('clamps within bounds', () => {
    expect(clamp(150, 0, 100)).toBe(100)
    expect(clamp(-5, 0, 100)).toBe(0)
    expect(clamp(42, 0, 100)).toBe(42)
  })
})

describe('formatMinutes', () => {
  it('formats minutes, hours and mixed', () => {
    expect(formatMinutes(35)).toBe('35m')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatMinutes(80)).toBe('1h 20m')
  })
  it('never goes negative', () => {
    expect(formatMinutes(-10)).toBe('0m')
  })
})

describe('formatRelative', () => {
  const now = new Date('2026-11-03T12:00:00Z')
  it('describes recent times', () => {
    expect(formatRelative('2026-11-03T11:59:40Z', now)).toBe('just now')
    expect(formatRelative('2026-11-03T11:30:00Z', now)).toBe('30m ago')
    expect(formatRelative('2026-11-03T09:00:00Z', now)).toBe('3h ago')
    expect(formatRelative('2026-11-01T12:00:00Z', now)).toBe('2d ago')
    expect(formatRelative('2026-10-20T12:00:00Z', now)).toBe('2w ago')
  })
  it('returns empty string for invalid dates', () => {
    expect(formatRelative('not-a-date', now)).toBe('')
  })
})

describe('greetingFor', () => {
  it('changes with the hour', () => {
    expect(greetingFor(new Date(2026, 0, 1, 8))).toBe('Good morning')
    expect(greetingFor(new Date(2026, 0, 1, 14))).toBe('Good afternoon')
    expect(greetingFor(new Date(2026, 0, 1, 20))).toBe('Good evening')
    expect(greetingFor(new Date(2026, 0, 1, 2))).toBe('Good night')
  })
})
