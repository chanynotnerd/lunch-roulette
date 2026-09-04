import { isDayHoursShape, isPlainObject } from '@/rules/hours-schema'
import { prevDay, seoulClock, toMinutes } from '@/rules/time'
import type { DayHours, Hours } from '@/rules/types'

/**
 * 현재 시각(Asia/Seoul)에 영업 중인지 판정한다. 스펙 05.
 * - hours가 null이면 false.
 * - 오늘 항목: open ≤ m < close, 브레이크 구간(start 포함, end 미포함)은 제외.
 *   close ≤ open이면 자정 넘김으로 보아 m ≥ open이면 영업 중.
 * - 어제 항목이 자정 넘김이고 m < 어제 close이면 어제 영업의 연장. 어제 브레이크는 무시.
 * 시각 비교는 분 단위, 시작 포함, 끝 미포함.
 *
 * 형식이 잘못된 hours(객체가 아님, 요일 항목 누락, "HH:MM" 이 아닌 값 등)는 예외 대신 false 로 닫는다(fail-closed).
 * 휴무는 closed === true 일 때만이다. {closed:false, open, close} 는 보통 영업일로 본다.
 */
export function isOpenAt(hours: Hours | null, now: Date): boolean {
  if (!isPlainObject(hours)) return false
  const { weekday, minutes: m } = seoulClock(now)

  if (isOpenToday(hours[weekday], m)) return true
  return isOvernightFromYesterday(hours[prevDay(weekday)], m)
}

function isOpenToday(today: unknown, m: number): boolean {
  if (!isDayHoursShape(today)) return false
  if (isClosed(today)) return false
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

function isOvernightFromYesterday(yesterday: unknown, m: number): boolean {
  if (!isDayHoursShape(yesterday)) return false
  if (isClosed(yesterday)) return false
  const o = toMinutes(yesterday.open)
  const c = toMinutes(yesterday.close)
  return c < o && m < c
}

function isClosed(day: DayHours): day is { closed: true } {
  return 'closed' in day && day.closed === true
}
