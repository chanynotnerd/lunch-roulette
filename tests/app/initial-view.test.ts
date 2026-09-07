import { describe, expect, it } from 'vitest'
import { EMPTY_ZOOM, SINGLE_ZOOM, initialView } from '@/app/(app)/records/initial-view'
import type { MapMarker } from '@/actions/records-types'

const FALLBACK = { lat: 37.5665, lng: 126.978 }

function marker(id: string, lat: number, lng: number): MapMarker {
  return { restaurantId: id, name: id, address: '', lat, lng, visits: 1, level: 2, levelName: '익숙', lastVisitDate: '2026-09-04' }
}

describe('initialView', () => {
  it('마커가 없으면 기본 중심, 확대 5', () => {
    expect(initialView([], FALLBACK)).toEqual({ kind: 'center', center: FALLBACK, zoom: EMPTY_ZOOM })
    expect(EMPTY_ZOOM).toBe(5)
  })

  it('마커가 하나면 그 지점 중심, 확대 4', () => {
    expect(initialView([marker('a', 37.5, 127.03)], FALLBACK)).toEqual({
      kind: 'center',
      center: { lat: 37.5, lng: 127.03 },
      zoom: SINGLE_ZOOM,
    })
    expect(SINGLE_ZOOM).toBe(4)
  })

  it('마커가 둘 이상이면 좌표 전부를 담은 범위', () => {
    const out = initialView([marker('a', 37.5, 127.03), marker('b', 37.51, 127.04), marker('c', 37.49, 127.0)], FALLBACK)
    expect(out).toEqual({
      kind: 'bounds',
      points: [
        { lat: 37.5, lng: 127.03 },
        { lat: 37.51, lng: 127.04 },
        { lat: 37.49, lng: 127.0 },
      ],
    })
  })
})
