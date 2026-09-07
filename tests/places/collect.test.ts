import { describe, expect, it } from 'vitest'
import { GRID_THRESHOLD_M, gridCells } from '@/places/collect'

const CENTER = { lat: 37.5, lng: 127.0 }
const M_PER_DEG_LAT = 111_320

type Rect = { x1: number; y1: number; x2: number; y2: number }

function parseRect(cell: { kind: string; rect?: string }): Rect {
  if (cell.kind !== 'rect' || !cell.rect) throw new Error('rect 셀이 아님')
  const [x1, y1, x2, y2] = cell.rect.split(',').map(Number)
  return { x1, y1, x2, y2 }
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

describe('gridCells', () => {
  it('500m 이하는 radius 셀 하나', () => {
    expect(GRID_THRESHOLD_M).toBe(500)
    expect(gridCells(CENTER, 100)).toEqual([{ kind: 'radius' }])
    expect(gridCells(CENTER, 500)).toEqual([{ kind: 'radius' }])
  })

  it('501m 이상은 rect 셀 넷', () => {
    expect(gridCells(CENTER, 501)).toHaveLength(4)
    expect(gridCells(CENTER, 1000)).toHaveLength(4)
    for (const c of gridCells(CENTER, 800)) {
      expect(c.kind).toBe('rect')
      const r = parseRect(c)
      expect(r.x1).toBeLessThan(r.x2)
      expect(r.y1).toBeLessThan(r.y2)
    }
  })

  it('네 셀은 중심 ±R 정사각형을 빈틈없이 덮고 서로 겹치지 않는다', () => {
    const R = 800
    const rects = gridCells(CENTER, R).map(parseRect)
    const dLat = R / M_PER_DEG_LAT
    const dLng = R / (M_PER_DEG_LAT * Math.cos((CENTER.lat * Math.PI) / 180))
    const W = CENTER.lng - dLng
    const E = CENTER.lng + dLng
    const S = CENTER.lat - dLat
    const N = CENTER.lat + dLat

    // 사분면이 하나씩
    const quadrant = (r: Rect) =>
      `${near(r.x1, W) ? 'W' : near(r.x1, CENTER.lng) ? 'E' : '?'}${near(r.y1, S) ? 'S' : near(r.y1, CENTER.lat) ? 'N' : '?'}`
    expect(rects.map(quadrant).sort()).toEqual(['EN', 'ES', 'WN', 'WS'])

    // 외곽이 정사각형과 일치
    expect(Math.min(...rects.map((r) => r.x1))).toBeCloseTo(W, 9)
    expect(Math.max(...rects.map((r) => r.x2))).toBeCloseTo(E, 9)
    expect(Math.min(...rects.map((r) => r.y1))).toBeCloseTo(S, 9)
    expect(Math.max(...rects.map((r) => r.y2))).toBeCloseTo(N, 9)

    // 넓이 합 = 정사각형 넓이 (빈틈 없음)
    const area = rects.reduce((sum, r) => sum + (r.x2 - r.x1) * (r.y2 - r.y1), 0)
    expect(area).toBeCloseTo((E - W) * (N - S), 12)

    // 겹치지 않음 (모서리만 닿는다)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        const disjoint = a.x2 <= b.x1 || b.x2 <= a.x1 || a.y2 <= b.y1 || b.y2 <= a.y1
        expect(disjoint).toBe(true)
      }
    }

    // 안쪽 경계는 문자열에서 같은 숫자를 쓴다 (셀 사이 빈틈이 부동소수점으로도 생기지 않음)
    const xs = new Set(rects.flatMap((r) => [r.x1, r.x2]))
    const ys = new Set(rects.flatMap((r) => [r.y1, r.y2]))
    expect(xs.size).toBe(3)
    expect(ys.size).toBe(3)
  })

  it('경도 폭은 위도에 따라 cos 보정된다', () => {
    const R = 1000
    const at37 = gridCells({ lat: 37.5, lng: 127.0 }, R).map(parseRect)
    const width = Math.max(...at37.map((r) => r.x2)) - Math.min(...at37.map((r) => r.x1))
    const height = Math.max(...at37.map((r) => r.y2)) - Math.min(...at37.map((r) => r.y1))
    expect(width / height).toBeCloseTo(1 / Math.cos((37.5 * Math.PI) / 180), 6)

    const at0 = gridCells({ lat: 0, lng: 10 }, R).map(parseRect)
    const w0 = Math.max(...at0.map((r) => r.x2)) - Math.min(...at0.map((r) => r.x1))
    const h0 = Math.max(...at0.map((r) => r.y2)) - Math.min(...at0.map((r) => r.y1))
    expect(w0).toBeCloseTo(h0, 9)
    expect(h0).toBeCloseTo((2 * R) / M_PER_DEG_LAT, 9)
  })
})
