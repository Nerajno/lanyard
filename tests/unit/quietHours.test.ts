import { describe, it, expect } from 'vitest'
import { HOURS, formatHour, validateQuietHours } from '~/utils/quietHours'

describe('quiet hours', () => {
  it('lists 24 hours', () => expect(HOURS).toEqual(Array.from({ length: 24 }, (_, i) => i)))
  it('formats as HH:00', () => {
    expect(formatHour(9)).toBe('09:00')
    expect(formatHour(21)).toBe('21:00')
  })
  it('accepts a window that wraps midnight', () => expect(validateQuietHours(21, 9)).toBeNull())
  it('rejects equal start and end', () => expect(validateQuietHours(9, 9)).toBe('Quiet hours need different start and end times.'))
  it('rejects out-of-range or fractional hours', () => {
    expect(validateQuietHours(24, 9)).toBe('Pick hours between 00:00 and 23:00.')
    expect(validateQuietHours(-1, 9)).toBe('Pick hours between 00:00 and 23:00.')
    expect(validateQuietHours(9.5, 10)).toBe('Pick hours between 00:00 and 23:00.')
  })
})
