import { describe, expect, it } from 'vitest'
import { distanceMeters } from '@/places/distance'

describe('distanceMeters', () => {
  it('같은 지점은 0', () => {
    expect(distanceMeters({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 })).toBe(0)
  })

  it('서울시청 ↔ 강남역 ≈ 8.7km (±0.3km)', () => {
    const d = distanceMeters({ lat: 37.5665, lng: 126.978 }, { lat: 37.4979, lng: 127.0276 })
    expect(d).toBeGreaterThan(8400)
    expect(d).toBeLessThan(9000)
  })

  it('대칭', () => {
    const a = { lat: 37.5665, lng: 126.978 }
    const b = { lat: 37.4979, lng: 127.0276 }
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6)
  })
})
