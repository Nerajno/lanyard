import { describe, it, expect } from 'vitest'
import { composerUrl } from '~/utils/composer'

const HOW_MET = 'Met at the GraphQL meetup & talked caching'

describe('composerUrl', () => {
  it('builds a mailto with how_met verbatim in the body', () => {
    const url = composerUrl({ email: 'ada@example.com', phone: null }, HOW_MET)
    expect(url.startsWith('mailto:ada@example.com?subject=')).toBe(true)
    expect(decodeURIComponent(url.split('&body=')[1])).toContain(HOW_MET)
  })
  it('refuses an injected email and falls back to sms', () => {
    const url = composerUrl({ email: 'a@b.com?bcc=evil@x.io', phone: '+1 (555) 010-0000' }, HOW_MET)
    expect(url).not.toContain('bcc')
    expect(url.startsWith('sms:15550100000?body=')).toBe(true)
    expect(decodeURIComponent(url.split('?body=')[1])).toContain(HOW_MET)
  })
  it('only one query string in the mailto', () => {
    const url = composerUrl({ email: 'ada@example.com', phone: null }, 'x?bcc=evil@x.io')
    expect(url.split('?').length).toBe(2)
  })
})
