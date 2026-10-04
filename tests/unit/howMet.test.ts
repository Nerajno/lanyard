import { describe, it, expect } from 'vitest'
import { applyHowMetChip, cleanHowMet, recentHowMetPrefixes } from '~/utils/howMet'

const c = (how_met: string, created_at: string) => ({ how_met, created_at })

describe('recentHowMetPrefixes', () => {
  it('takes the text before the first · from the newest contacts', () => {
    expect(recentHowMetPrefixes([
      c('Design Summit · talked tokens', '2026-10-01T00:00:00Z'),
      c('WebSummit 2026 · coffee line', '2026-10-03T00:00:00Z'),
      c('Intro via Sam', '2026-10-02T00:00:00Z'),
    ])).toEqual(['WebSummit 2026', 'Intro via Sam', 'Design Summit'])
  })

  it('de-duplicates case-insensitively and respects the limit', () => {
    expect(recentHowMetPrefixes([
      c('webSummit · a', '2026-10-03T00:00:00Z'),
      c('WebSummit · b', '2026-10-02T00:00:00Z'),
      c('Meetup', '2026-10-01T00:00:00Z'),
    ], 1)).toEqual(['webSummit'])
  })

  it('caps long prefixes at 30 characters and drops blanks', () => {
    const long = 'A very long conference name that keeps going'
    expect(recentHowMetPrefixes([c(long, '2026-10-03T00:00:00Z'), c('  · x', '2026-10-02T00:00:00Z')]))
      .toEqual([long.slice(0, 30).trim()])
  })
})

describe('applyHowMetChip', () => {
  it('prefixes the chip', () => expect(applyHowMetChip('talked Postgres', 'WebSummit')).toBe('WebSummit · talked Postgres'))
  it('fills an empty field', () => expect(applyHowMetChip('  ', 'WebSummit')).toBe('WebSummit · '))
  it('does not stack the same chip', () => expect(applyHowMetChip('WebSummit · x', 'WebSummit')).toBe('WebSummit · x'))
})

describe('cleanHowMet', () => {
  it('removes a dangling chip separator', () => {
    expect(cleanHowMet('WebSummit · ')).toBe('WebSummit')
    expect(cleanHowMet('   WebSummit   ·   ')).toBe('WebSummit')
  })
  it('leaves text with content after the separator', () => {
    expect(cleanHowMet('WebSummit · talked Postgres')).toBe('WebSummit · talked Postgres')
  })
  it('preserves text without a separator', () => {
    expect(cleanHowMet('WebSummit')).toBe('WebSummit')
  })
})
