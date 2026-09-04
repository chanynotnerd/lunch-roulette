import type { DayHours, Hours } from '@/rules/types'

/**
 * 영업시간 정보를 주지 않는 소스(카카오)에서 온 식당의 기본 영업시간. (D17)
 * 브레이크타임 없음, 매일 11:00~21:00. 실제 시간은 data/hours-overrides.json 으로 덮어쓴다.
 */
const day: DayHours = { open: '11:00', close: '21:00' }

export const DEFAULT_HOURS: Hours = {
  mon: day,
  tue: day,
  wed: day,
  thu: day,
  fri: day,
  sat: day,
  sun: day,
}
