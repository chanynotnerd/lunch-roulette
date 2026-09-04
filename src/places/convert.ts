import { DAY_KEYS, type DayHours, type DayKey, type Hours, type TimeRange } from '@/rules/types'

export type GPoint = { day: number; hour: number; minute: number }
export type GPeriod = { open: GPoint; close?: GPoint }
export type GoogleOpeningHours = { periods?: GPeriod[] }

// Google: 0=Sunday .. 6=Saturday
const GOOGLE_DAY_TO_KEY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

type Span = { start: number; end: number; overnight: boolean }

function fmt(minutes: number): string {
  if (minutes >= 1440) return '24:00'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function isAlwaysOpen(periods: GPeriod[]): boolean {
  if (periods.length !== 1) return false
  const p = periods[0]
  return !p.close && p.open.day === 0 && p.open.hour === 0 && p.open.minute === 0
}

export function toHours(regular?: GoogleOpeningHours | null): Hours | null {
  const periods = regular?.periods
  if (!periods || periods.length === 0) return null

  const result = {} as Record<DayKey, DayHours>

  if (isAlwaysOpen(periods)) {
    for (const key of DAY_KEYS) result[key] = { open: '00:00', close: '24:00' }
    return result as Hours
  }

  const byDay = new Map<DayKey, Span[]>()
  for (const p of periods) {
    const key = GOOGLE_DAY_TO_KEY[p.open.day]
    if (!key) continue
    const start = p.open.hour * 60 + p.open.minute
    const end = p.close ? p.close.hour * 60 + p.close.minute : 1440
    const overnight = !!p.close && p.close.day !== p.open.day
    const list = byDay.get(key) ?? []
    list.push({ start, end, overnight })
    byDay.set(key, list)
  }

  for (const key of DAY_KEYS) {
    const spans = byDay.get(key)
    if (!spans || spans.length === 0) {
      result[key] = { closed: true }
      continue
    }
    spans.sort((a, b) => a.start - b.start)
    const first = spans[0]
    const last = spans[spans.length - 1]
    const day: { open: string; close: string; break?: TimeRange } = {
      open: fmt(first.start),
      close: fmt(last.end),
    }
    if (spans.length >= 2) {
      const second = spans[1]
      if (!first.overnight && first.end < second.start) {
        day.break = { start: fmt(first.end), end: fmt(second.start) }
      }
    }
    result[key] = day
  }

  return result as Hours
}
