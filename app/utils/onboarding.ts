import type { Profile } from '~/types'

/** True once the user has completed first-run setup (onboarded_at set). */
export function isOnboarded(profile: Pick<Profile, 'onboarded_at'> | null | undefined): boolean {
  return Boolean(profile?.onboarded_at)
}