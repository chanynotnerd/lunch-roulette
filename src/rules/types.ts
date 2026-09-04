export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export type TimeRange = { start: string; end: string } // "HH:MM"
export type DayHours =
  | { closed: true }
  | { open: string; close: string; break?: TimeRange } // "HH:MM"; close "24:00" allowed
export type Hours = Record<DayKey, DayHours>

export type Slot = 'lunch' | 'dinner'
