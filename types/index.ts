import type { Database as GeneratedDatabase } from '~/types/database'

// Convenience type aliases matching the DB tables. Kept close to the schema
// so the Rest composables and components stay typed.

export type Profile = GeneratedDatabase['public']['Tables']['profiles']['Row']
export type Contact = GeneratedDatabase['public']['Tables']['contacts']['Row']
export type Nudge = GeneratedDatabase['public']['Tables']['nudges']['Row']

export type InsertContact = GeneratedDatabase['public']['Tables']['contacts']['Insert']
export type UpdateContact = GeneratedDatabase['public']['Tables']['contacts']['Update']
export type InsertProfile = GeneratedDatabase['public']['Tables']['profiles']['Insert']
export type UpdateProfile = GeneratedDatabase['public']['Tables']['profiles']['Update']

export type ContactStatus = Contact['status']

export const LADDER_PRESETS: Record<'warm' | 'default' | 'slow', number[]> = {
  warm: [1, 7, 21],
  default: [2, 14, 45],
  slow: [7, 30, 90],
}

export const LADDER_NAMES = Object.keys(LADDER_PRESETS) as (keyof typeof LADDER_PRESETS)[]

export const DEFAULT_QUIET_HOURS = { from: 9, to: 21 } // local: send between 09:00 and 21:00