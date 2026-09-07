import { SLOTS } from '@/config/slots'
import { getLevel } from '@/rules/level'
import type { Slot } from '@/rules/types'
import { levelAtTime, levelName } from '@/actions/roulette-helpers'
import type { MapMarker, PlaceMarker, RecordRow } from '@/actions/records-types'

/** 기록 액션에서 쓰는 순수 헬퍼. 'use server'가 아니므로 단위 테스트가 가능하다. 스펙 16 데이터. */

export type JoinedRestaurant = {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
}

/** roulette_sessions에 places(name), restaurants(id, name, address, lat, lng)를 조인한 행. */
export type JoinedRow = {
  slot_date: string
  slot: Slot
  chosen_restaurant_id: string | null
  confirmed_at: string | null
  places: { name: string } | { name: string }[] | null
  restaurants: JoinedRestaurant | JoinedRestaurant[] | null
}

const DELETED_PLACE = '삭제된 장소'

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/**
 * F8. 날짜별 기록. 입력 순서(slot_date desc, slot desc)를 지킨다.
 * 확정 당시 레벨은 같은 식당의 confirmed_at ≤ 이 행 시각인 행 수로 계산한다(levelAtTime).
 */
export function toRecordRows(rows: JoinedRow[]): RecordRow[] {
  const out: RecordRow[] = []
  for (const r of rows) {
    if (!r.chosen_restaurant_id || !r.confirmed_at) continue
    const level = levelAtTime(rows, r.chosen_restaurant_id, r.confirmed_at)
    out.push({
      slotDate: r.slot_date,
      slot: r.slot,
      slotLabel: SLOTS[r.slot].label,
      placeName: one(r.places)?.name ?? DELETED_PLACE,
      restaurantId: r.chosen_restaurant_id,
      restaurantName: one(r.restaurants)?.name ?? '',
      levelAtThatTime: level,
      levelName: levelName(level),
    })
  }
  return out
}

/**
 * 식당 하나 = 마커 하나 (스펙 16 M1). visits는 confirmed 행 수, level은 getLevel(visits).
 * 좌표가 유한한 숫자가 아닌 식당은 뺀다. 정렬: visits desc, name asc.
 */
export function toMarkers(rows: JoinedRow[]): MapMarker[] {
  const byId = new Map<string, MapMarker>()
  for (const r of rows) {
    if (!r.chosen_restaurant_id || !r.confirmed_at) continue
    const rest = one(r.restaurants)
    if (!rest) continue
    const found = byId.get(rest.id)
    if (found) {
      found.visits += 1
      if (r.slot_date > found.lastVisitDate) found.lastVisitDate = r.slot_date
      continue
    }
    if (typeof rest.lat !== 'number' || typeof rest.lng !== 'number') continue
    if (!Number.isFinite(rest.lat) || !Number.isFinite(rest.lng)) continue
    byId.set(rest.id, {
      restaurantId: rest.id,
      name: rest.name,
      address: rest.address,
      lat: rest.lat,
      lng: rest.lng,
      visits: 1,
      level: 1,
      levelName: '',
      lastVisitDate: r.slot_date,
    })
  }
  const out = [...byId.values()].map((m) => {
    const lv = getLevel(m.visits)
    return { ...m, level: lv.level, levelName: lv.name }
  })
  out.sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, 'ko'))
  return out
}

/** places 테이블 행 중 지도에 필요한 것. */
export type PlaceRow = {
  id: string
  name: string
  lat: number | null
  lng: number | null
}

/** 장소 행 → 장소 마커. 좌표가 유한한 숫자가 아닌 장소는 뺀다. 입력 순서(생성순)를 지킨다. */
export function toPlaceMarkers(rows: PlaceRow[]): PlaceMarker[] {
  const out: PlaceMarker[] = []
  for (const r of rows) {
    if (typeof r.lat !== 'number' || typeof r.lng !== 'number') continue
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue
    out.push({ id: r.id, name: r.name, lat: r.lat, lng: r.lng })
  }
  return out
}
