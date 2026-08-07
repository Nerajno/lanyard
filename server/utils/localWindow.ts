// Local-time send window. Uses Intl so we don't need a tz database dependency.
// Default send window is 09:00–21:00 in the user's local timezone.

function hourInTimezone(timezone: string, now: Date): number {
  try {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(now))
  } catch {
    return now.getHours()
  }
}

/** True when it's currently inside the 09:00–21:00 local send window. */
export function shouldDeliverNow(timezone: string, now: Date = new Date()): boolean {
  const hour = hourInTimezone(timezone, now)
  return hour >= 9 && hour < 21
}