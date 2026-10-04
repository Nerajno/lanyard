// Suggestion chips for the capture form, built from the user's own recent
// how_met values. Display-only: how_met is still stored verbatim.
import type { Contact } from '~/types'

const MAX_CHIP = 30

export function recentHowMetPrefixes(contacts: Pick<Contact, 'how_met' | 'created_at'>[], limit = 3): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const newest = [...contacts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  for (const c of newest) {
    const prefix = c.how_met.split('·')[0].trim()
    if (!prefix) continue
    const capped = prefix.length > MAX_CHIP ? prefix.slice(0, MAX_CHIP).trim() : prefix
    const lower = capped.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    out.push(capped)
    if (out.length >= limit) break
  }
  return out
}

export function applyHowMetChip(current: string, chip: string): string {
  const trimmed = current.trim()
  if (trimmed.toLowerCase().startsWith(chip.toLowerCase() + ' · ')) {
    return current
  }
  return `${chip} · ${current.replace(/^\s+/, '')}`
}
