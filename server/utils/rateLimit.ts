// Sliding-window rate limiter, in memory.
//
// Best-effort on serverless: each warm function instance keeps its own map,
// and a cold start begins empty. That's enough to blunt a single script
// hammering an endpoint; it is not a global quota. Pair it with cheap
// server-side checks (honeypot, validation, unique constraints).

export interface RateLimitResult {
  allowed: boolean
  /** Whole seconds until the next hit would be allowed (0 when allowed). */
  retryAfterSec: number
}

export interface RateLimiterOptions {
  limit: number
  windowMs: number
  /** Most keys tracked at once; the least recently seen key is evicted past this. */
  maxKeys?: number
  now?: () => number
}

export function createRateLimiter({ limit, windowMs, maxKeys = 10_000, now = Date.now }: RateLimiterOptions) {
  // Map keeps insertion order, so re-inserting on each hit makes the first key the least recently seen.
  const hits = new Map<string, number[]>()

  function hit(key: string): RateLimitResult {
    const t = now()
    const recent = (hits.get(key) ?? []).filter(ts => t - ts < windowMs)

    if (recent.length >= limit) {
      hits.delete(key)
      hits.set(key, recent)
      const oldest = recent[0] ?? t
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - t) / 1000)) }
    }

    recent.push(t)
    hits.delete(key)
    hits.set(key, recent)
    while (hits.size > maxKeys) {
      const lru = hits.keys().next().value
      if (lru === undefined) break
      hits.delete(lru)
    }
    return { allowed: true, retryAfterSec: 0 }
  }

  return {
    hit,
    size: () => hits.size,
    reset: () => hits.clear(),
  }
}
