import type { LatLng } from './types'

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
