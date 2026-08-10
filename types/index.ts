import type { Database as GeneratedDatabase } from '~/types/database'

// Convenience type aliases matching the DB tables. Kept close to the schema
// so the Rest composables and components stay typed.

export type Profile = GeneratedDatabase['public']['Tables']['profiles']['Row']
export type Contact = GeneratedDatabase['public']['Tables']['contacts']['Row']
export type Nudge = GeneratedDatabase['public']['Tables']['nudges']['Row']
export type Share = GeneratedDatabase['public']['Tables']['shares']['Row']
export type SmsSuppression = GeneratedDatabase['public']['Tables']['sms_suppressions']['Row']
export type AccountDeletion = GeneratedDatabase['public']['Tables']['account_deletions']['Row']

export type InsertContact = GeneratedDatabase['public']['Tables']['contacts']['Insert']
export type UpdateContact = GeneratedDatabase['public']['Tables']['contacts']['Update']
export type InsertProfile = GeneratedDatabase['public']['Tables']['profiles']['Insert']
export type UpdateProfile = GeneratedDatabase['public']['Tables']['profiles']['Update']
export type InsertShare = GeneratedDatabase['public']['Tables']['shares']['Insert']
export type UpdateShare = GeneratedDatabase['public']['Tables']['shares']['Update']

export type ContactStatus = Contact['status']

export type LadderUnit = 'min' | 'hour' | 'day'
export type LadderRung = { value: number; unit: LadderUnit }
export type Ladder = LadderRung[]

export const LADDER_PRESETS: Record<'warm' | 'default' | 'slow', Ladder> = {
  warm: [{ value: 1, unit: 'day' }, { value: 7, unit: 'day' }, { value: 21, unit: 'day' }],
  default: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
  slow: [{ value: 7, unit: 'day' }, { value: 30, unit: 'day' }, { value: 90, unit: 'day' }],
}

export const LADDER_NAMES = Object.keys(LADDER_PRESETS) as (keyof typeof LADDER_PRESETS)[]

export const DEFAULT_QUIET_HOURS = { from: 9, to: 21 } // local: send between 09:00 and 21:00