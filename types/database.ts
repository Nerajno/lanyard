// Hand-maintained Supabase Database typing for Lanyard.
// Mirrors supabase/migrations/0001_initial_schema.sql. Keep in sync with the schema.
// (When a real Supabase project is wired, regenerate with `npx supabase gen types typescript`.)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          email: string | null
          phone: string | null
          phone_verified_at: string | null
          nudge_channel: 'sms' | 'email' | 'both'
          timezone: string
          quiet_hours: [number, number] | null
          sms_opt_in_at: string | null
          sms_opted_out_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          nudge_channel?: 'sms' | 'email' | 'both'
          timezone?: string
          quiet_hours?: [number, number] | null
          sms_opt_in_at?: string | null
          sms_opted_out_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          name: string
          how_met: string
          email: string | null
          phone: string | null
          cadence_ladder: number[]
          touchpoints_done: number
          follow_up_by: string
          status: 'active' | 'graduated' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          how_met: string
          email?: string | null
          phone?: string | null
          cadence_ladder?: number[]
          touchpoints_done?: number
          follow_up_by: string
          status?: 'active' | 'graduated' | 'archived'
        }
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
      }
      nudges: {
        Row: {
          id: string
          user_id: string
          contact_ids: string[]
          channel: 'sms' | 'email'
          sent_at: string
          opened_at: string | null
          acted_at: string | null
          provider_message_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contact_ids: string[]
          channel: 'sms' | 'email'
          sent_at?: string
          opened_at?: string | null
          acted_at?: string | null
          provider_message_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['nudges']['Insert']>
      }
    }
  }
}