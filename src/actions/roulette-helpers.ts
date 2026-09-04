import { getLevel } from '@/rules/level'
import { LEVELS } from '@/config/levels'
import { SLOTS } from '@/config/slots'
import { nextSlotStart } from '@/rules/slot'
import { seoulClock } from '@/rules/time'
import type { Hours, Slot } from '@/rules/types'

/** 룰렛 액션에서 쓰는 순수 헬퍼. 'use server'가 아니므로 단위 테스트가 가능하다. */

export type Candidate = {
  id: string
  name: string
  address: string
  xp: number
  level: number
  levelName: string
  nextIn: number | null
}

export type RestaurantRow = {
  id: string
  name: string
  address: string
  hours: Hours | null
}

export type ConfirmedRow = {
  chosen_restaurant_id: string | null
  confirmed_at: string | null
}

/** confirmed 세션 행에서 식당별 경험치(확정 횟수)를 센다. ids에 있는 식당은 0으로라도 항상 포함된다. */
export function countXp(rows: { chosen_restaurant_id: string | null }[], ids: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const id of ids) map.set(id, 0)
  for (const r of rows) {
    if (!r.chosen_restaurant_id) continue
    map.set(r.chosen_restaurant_id, (map.get(r.chosen_restaurant_id) ?? 0) + 1)
  }
  return map
}

/** 이번 확정으로 경험치가 newXp가 되었을 때 레벨이 올랐는지. newXp는 이번 확정을 포함한 값. */
export function isLevelUp(newXp: number): boolean {
  if (newXp <= 0) return false
  return getLevel(newXp).level > getLevel(newXp - 1).level
}

/**
 * 확정 당시 레벨. 그 식당을 confirmedAt 이하 시각에 확정한 횟수(해당 행 포함)를 레벨 테이블에 대입한다.
 * 스펙 06 F8: "그 세션 이전까지의 확정 횟수 + 1".
 */
export function levelAtTime(rows: ConfirmedRow[], restaurantId: string, confirmedAt: string): number {
  const t = new Date(confirmedAt).getTime()
  let count = 0
  for (const r of rows) {
    if (r.chosen_restaurant_id !== restaurantId || !r.confirmed_at) continue
    if (new Date(r.confirmed_at).getTime() <= t) count++
  }
  return getLevel(Math.max(count, 1)).level
}

export function toCandidate(row: RestaurantRow, xp: number): Candidate {
  const lv = getLevel(xp)
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    xp,
    level: lv.level,
    levelName: lv.name,
    nextIn: lv.nextIn,
  }
}

/** 세션의 슬롯이 끝난 뒤 열리는 다음 슬롯 시작 시각 "HH:MM". 확정 화면의 "다음 룰렛" 안내용. */
export function nextSlotAfter(slot: Slot, now: Date): string {
  const { minutes } = seoulClock(now)
  const untilEnd = Math.max(SLOTS[slot].end - minutes, 0)
  return nextSlotStart(new Date(now.getTime() + untilEnd * 60_000))
}

/** 레벨 번호 → 레벨 이름. 테이블은 config/levels.ts 한 곳에만 둔다. */
export function levelName(level: number): string {
  return LEVELS.find((l) => l.level === level)?.name ?? LEVELS[0].name
}
