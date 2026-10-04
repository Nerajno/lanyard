// Quiet-hours window in the user's local time. start → end may wrap midnight
// (21 → 9 means 21:00 to 09:00). The cron already honours these columns.
export const HOURS: number[] = Array.from({ length: 24 }, (_, i) => i)

export function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

export function validateQuietHours(start: number, end: number): string | null {
  const ok = (h: number) => Number.isInteger(h) && h >= 0 && h <= 23
  if (!ok(start) || !ok(end)) return 'Pick hours between 00:00 and 23:00.'
  if (start === end) return 'Quiet hours need different start and end times.'
  return null
}
