import type { LatLng } from './types'
import { distanceMeters } from './distance'

/**
 * 식당 수집의 fetch 없는 순수 함수들 (스펙 17).
 * - gridCells: 반경에 따라 질의 셀을 정한다. 500m 이하 radius 하나, 초과는 2×2 rect.
 * - capByDistance: 중심 거리순으로 정렬하고 상한까지 자른다.
 * - mapWithConcurrency: 동시 실행 제한. 하나가 실패하면 새 작업을 시작하지 않는다.
 */

/** 이 반경까지는 radius 질의 하나, 넘으면 2×2 rect 격자. (스펙 17 수집 알고리즘 1) */
export const GRID_THRESHOLD_M = 500

const M_PER_DEG_LAT = 111_320

export type Cell = { kind: 'radius' } | { kind: 'rect'; rect: string }

/**
 * 중심 ±R 정사각형을 넷으로 나눈 rect 셀. 카카오 rect 형식은 `x1,y1,x2,y2` (왼쪽 아래 → 오른쪽 위).
 * 안쪽 경계는 center.lng / center.lat 값을 그대로 써서 셀 사이에 부동소수점 빈틈이 생기지 않는다.
 */
export function gridCells(center: LatLng, radiusM: number): Cell[] {
  if (radiusM <= GRID_THRESHOLD_M) return [{ kind: 'radius' }]
  const dLat = radiusM / M_PER_DEG_LAT
  const dLng = radiusM / (M_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180))
  const W = center.lng - dLng
  const E = center.lng + dLng
  const S = center.lat - dLat
  const N = center.lat + dLat
  const cx = center.lng
  const cy = center.lat
  return [
    { kind: 'rect', rect: `${W},${S},${cx},${cy}` },
    { kind: 'rect', rect: `${cx},${S},${E},${cy}` },
    { kind: 'rect', rect: `${W},${cy},${cx},${N}` },
    { kind: 'rect', rect: `${cx},${cy},${E},${N}` },
  ]
}

/**
 * 중심 거리 오름차순 정렬 후 max 개까지. 같은 거리는 google_place_id 코드 단위 문자열순으로 고정해
 * 결과를 결정적으로 만든다. (스펙 17 수집 알고리즘 3)
 */
export function capByDistance<T extends { google_place_id: string; lat: number; lng: number }>(
  center: LatLng,
  list: T[],
  max: number,
): T[] {
  const withDistance = list.map((item) => ({ item, d: distanceMeters(center, { lat: item.lat, lng: item.lng }) }))
  withDistance.sort((a, b) => {
    if (a.d !== b.d) return a.d - b.d
    if (a.item.google_place_id === b.item.google_place_id) return 0
    return a.item.google_place_id < b.item.google_place_id ? -1 : 1
  })
  return withDistance.slice(0, Math.max(0, max)).map((w) => w.item)
}

/**
 * items 를 최대 limit 개씩 동시에 fn 으로 처리한다. 결과는 입력 순서.
 * 하나가 reject 하면 아직 시작하지 않은 항목은 시작하지 않고 그 오류로 reject 한다.
 * 이미 진행 중인 항목은 끝나도 결과를 쓰지 않는다(전체가 이미 reject 됐으므로). (스펙 17 E6, E7)
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`limit must be a positive integer: ${limit}`)
  const results: R[] = new Array(items.length)
  let next = 0
  let failed = false

  async function worker(): Promise<void> {
    while (!failed) {
      const i = next++
      if (i >= items.length) return
      try {
        results[i] = await fn(items[i], i)
      } catch (e) {
        failed = true
        throw e
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
