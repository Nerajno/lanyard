import { asInstant } from '~/utils/cadence'
import type { Share } from '~/types'

/** A share link is usable only when unused and not yet expired. Millisecond-exact. */
export function shareIsValid(share: Pick<Share, 'used_at' | 'expires_at'> | null | undefined, now: Date = new Date()): boolean {
  if (!share) return false
  if (share.used_at) return false
  if (asInstant(share.expires_at) < asInstant(now)) return false
  return true
}