// Builds the prefilled sms:/mailto: composer the act-link redirects to.
// Lanyard never sends the follow-up itself; the user hits send.
import { isValidContactEmail } from '~/utils/email'

export function composerUrl(contact: { email: string | null; phone: string | null }, howMet: string): string {
  if (isValidContactEmail(contact.email)) {
    const to = encodeURIComponent(contact.email).replace(/%40/g, '@')
    const subject = encodeURIComponent('Great connecting at the conference')
    const body = encodeURIComponent(`Hi,\n\n${howMet}\n\nBest,\n[Your name]`)
    return `mailto:${to}?subject=${subject}&body=${body}`
  }
  const phone = (contact.phone ?? '').replace(/\D/g, '')
  const body = encodeURIComponent(`Hi! ${howMet} — would love to keep in touch.`)
  return `sms:${phone}?body=${body}`
}
