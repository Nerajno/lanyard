import { watch } from 'vue'
import type { Ref } from 'vue'
import type { Contact, InsertContact, Ladder, LadderRung, UpdateContact } from '~/types'
import type { LadderPreset } from '~/utils/cadence'
import { addToTimestamp, advanceTouchpoint, initialFollowUp, resolveLadder, snooze } from '~/utils/cadence'

export interface NewContactInput {
  name: string
  how_met: string
  email?: string | null
  phone?: string | null
  ladderPreset: LadderPreset | 'custom'
  customLadder?: Ladder
}

/**
 * CRUD over contacts behind RLS. Uses the authenticated client, so every query
 * is scoped to auth.uid() by the database. Never bypasses RLS.
 */
export function useContacts() {
  const sb = useSupabase()
  const auth = useAuthStore()

  const contacts: Ref<Contact[]> = ref([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  watch(
    () => auth.user?.id,
    (id) => {
      if (id) void load()
    },
    { immediate: true },
  )

  async function load() {
    if (!auth.user) return
    loading.value = true
    error.value = null
    const { data, error: e } = await sb
      .from('contacts')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('follow_up_by', { ascending: true })
    if (e) {
      error.value = e.message
    } else {
      contacts.value = (data ?? []) as Contact[]
    }
    loading.value = false
  }

  /**
   * Insert a contact. Computes follow_up_by = created_at + cadence_ladder[1]
   * (the first rung), mirroring Architecture.md §Key flows → Add.
   */
  async function add(input: NewContactInput): Promise<Contact> {
    if (!auth.user) throw new Error('You must be signed in')

    const ladder = resolveLadder(input.ladderPreset, input.customLadder)
    const payload: InsertContact = {
      user_id: auth.user.id,
      name: input.name.trim(),
      how_met: input.how_met.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      cadence_ladder: ladder,
      follow_up_by: initialFollowUp(new Date().toISOString(), ladder),
    }

    const { data, error: e } = await sb.from('contacts').insert(payload).select().single()
    if (e) throw new Error(e.message)
    const created = data as Contact
    contacts.value = [created, ...contacts.value]
    return created
  }

  async function update(id: string, patch: UpdateContact): Promise<void> {
    if (!auth.user) throw new Error('You must be signed in')
    const { error: e } = await sb.from('contacts').update(patch).eq('id', id).eq('user_id', auth.user.id)
    if (e) throw new Error(e.message)
    await load()
  }

  async function remove(id: string): Promise<void> {
    if (!auth.user) throw new Error('You must be signed in')
    const { error: e } = await sb.from('contacts').delete().eq('id', id).eq('user_id', auth.user.id)
    if (e) throw new Error(e.message)
    contacts.value = contacts.value.filter((c: Contact) => c.id !== id)
  }

  /**
   * Mark a single touchpoint done. Advances the ladder, or graduates on the
   * third rung. Uses shared cadence logic so it can't drift from the tests.
   */
  async function markFollowedUp(id: string): Promise<void> {
    if (!auth.user) throw new Error('You must be signed in')
    const contact = contacts.value.find((c) => c.id === id)
    if (!contact) return

    const next = advanceTouchpoint(contact.cadence_ladder, contact.touchpoints_done, new Date())
    const patch: UpdateContact = {
      touchpoints_done: next?.touchpoints_done ?? contact.touchpoints_done + 1,
    }
    if (next) patch.follow_up_by = next.follow_up_by
    else patch.status = 'graduated'
    await update(id, patch)
  }

  /** Snooze a contact 3 days. Ladder position is unchanged — never consumes a rung. */
  async function snoozeContact(id: string, days = 3): Promise<void> {
    const contact = contacts.value.find((c) => c.id === id)
    if (!contact) return
    await update(id, { follow_up_by: snooze(contact.follow_up_by, days) })
  }

  /** Set a one-off reminder by deferring the next rung from now. */
  async function remindContact(id: string, rung: LadderRung): Promise<void> {
    if (!auth.user) throw new Error('You must be signed in')
    const contact = contacts.value.find((c) => c.id === id)
    if (!contact) return
    await update(id, { remind_at: addToTimestamp(new Date(), rung).toISOString() })
  }

  /** Manual archive — distinct from graduating. */
  async function archive(id: string): Promise<void> {
    await update(id, { status: 'archived' })
  }

  return { contacts, loading, error, load, add, update, remove, markFollowedUp, snoozeContact, remindContact, archive }
}