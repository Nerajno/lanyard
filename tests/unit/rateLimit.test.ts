import { describe, it, expect } from 'vitest'

import { createRateLimiter } from '~/server/utils/rateLimit'

describe('createRateLimiter', () => {
  it('allows up to the limit inside one window', () => {
    const t = 0
    const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t })
    expect(rl.hit('ip').allowed).toBe(true)
    expect(rl.hit('ip').allowed).toBe(true)
    expect(rl.hit('ip').allowed).toBe(true)
    expect(rl.hit('ip').allowed).toBe(false)
  })

  it('reports seconds until the oldest hit leaves the window', () => {
    let t = 0
    const rl = createRateLimiter({ limit: 1, windowMs: 10_000, now: () => t })
    rl.hit('ip')
    t = 2_500
    const r = rl.hit('ip')
    expect(r.allowed).toBe(false)
    expect(r.retryAfterSec).toBe(8)
  })

  it('slides: hits older than the window stop counting', () => {
    let t = 0
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t })
    rl.hit('ip')
    t = 600
    rl.hit('ip')
    expect(rl.hit('ip').allowed).toBe(false)
    t = 1001 // first hit has aged out
    expect(rl.hit('ip').allowed).toBe(true)
  })

  it('keeps keys independent', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 })
    expect(rl.hit('a').allowed).toBe(true)
    expect(rl.hit('b').allowed).toBe(true)
    expect(rl.hit('a').allowed).toBe(false)
  })

  it('does not record blocked hits, so a blocked client is not locked out longer', () => {
    let t = 0
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t })
    rl.hit('ip')
    t = 500
    rl.hit('ip') // blocked
    t = 1001
    expect(rl.hit('ip').allowed).toBe(true)
  })

  it('caps tracked keys so a flood of addresses cannot grow memory without bound', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2, now: () => 0 })
    rl.hit('a')
    rl.hit('b')
    rl.hit('c') // evicts the oldest key, "a"
    expect(rl.size()).toBe(2)
    expect(rl.hit('a').allowed).toBe(true)
  })
})
