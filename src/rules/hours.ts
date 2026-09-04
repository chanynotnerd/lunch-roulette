import { prevDay, seoulClock, toMinutes } from '@/rules/time'
import type { DayHours, Hours } from '@/rules/types'

/**
 * 현재 시각(Asia/Seoul)에 영업 중인지 판정한다. 스펙 05.
 * - hours가 null이면 false.
 * - 오늘 항목: open ≤ m < close, 브레이크 구간(start 포함, end 미포함)은 제외.
 *   close ≤ open이면 자정 넘김으로 보아 m ≥ open이면 영업 중.
 * - 어제 항목이 자정 넘김이고 m < 어제 close이면 어제 영업의 연장. 어제 브레이크는 무시.
 * 시각 비교는 분 단위, 시작 포함, 끝 미포함.
 */
export function isOpenAt(hours: Hours | null, now: Date): boolean {
  if (!hours) return false
  const { weekday, minutes: m } = seoulClock(now)

  if (isOpenToday(hours[weekday], m)) return true
  return isOvernightFromYesterday(hours[prevDay(weekday)], m)
}

function isOpenToday(today: DayHours, m: number): boolean {
  if ('closed' in today) return false
  const o = toMinutes(today.open)
  const c = toMinutes(today.close)
  const inRange = c > o ? o <= m && m < c : m >= o
  if (!inRange) return false
  if (today.break) {
    const bs = toMinutes(today.break.start)
    const be = toMinutes(today.break.end)
    if (bs <= m && m < be) return false
  }
  return true
}

function isOvernightFromYesterday(yesterday: DayHours, m: number): boolean {
  if ('closed' in yesterday) return false
  const o = toMinutes(yesterday.open)
  const c = toMinutes(yesterday.close)
  return c < o && m < c
}
