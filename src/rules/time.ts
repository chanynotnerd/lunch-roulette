import { DAY_KEYS, type DayKey } from '@/rules/types'

const WEEKDAY_MAP: Record<string, DayKey> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
}

const seoulFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  hourCycle: 'h23',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** Asia/Seoul 기준 날짜("YYYY-MM-DD"), 요일, 자정 이후 경과 분(0..1439). */
export function seoulClock(now: Date): { dateStr: string; weekday: DayKey; minutes: number } {
  const parts: Record<string, string> = {}
  for (const p of seoulFormatter.formatToParts(now)) {
    if (p.type !== 'literal') parts[p.type] = p.value
  }
  const weekday = WEEKDAY_MAP[parts.weekday]
  if (!weekday) throw new Error(`Unknown weekday: ${parts.weekday}`)
  // 일부 런타임은 hourCycle h23에서도 자정을 "24"로 줄 수 있어 방어한다.
  const hour = Number(parts.hour) % 24
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    minutes: hour * 60 + Number(parts.minute),
  }
}

/** "HH:MM" → 자정 이후 분. "24:00"은 1440. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function prevDay(d: DayKey): DayKey {
  const i = DAY_KEYS.indexOf(d)
  return DAY_KEYS[(i + DAY_KEYS.length - 1) % DAY_KEYS.length]
}
