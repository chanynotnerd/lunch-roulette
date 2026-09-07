import type { InitialView, LatLng, MapMarker } from '@/actions/records-types'

/** 카카오 확대 단계. 숫자가 작을수록 가깝다. 4 ≈ 100m 축척, 5 ≈ 250m. */
export const SINGLE_ZOOM = 4
export const EMPTY_ZOOM = 5

/**
 * 지도를 처음 열 때 보여 줄 범위. 스펙 16 M4.
 * 0개: 기본 중심. 1개: 그 마커 중심. 2개 이상: 마커 전부가 들어오는 범위.
 */
export function initialView(markers: MapMarker[], fallbackCenter: LatLng): InitialView {
  if (markers.length === 0) return { kind: 'center', center: fallbackCenter, zoom: EMPTY_ZOOM }
  if (markers.length === 1) {
    return { kind: 'center', center: { lat: markers[0].lat, lng: markers[0].lng }, zoom: SINGLE_ZOOM }
  }
  return { kind: 'bounds', points: markers.map((m) => ({ lat: m.lat, lng: m.lng })) }
}
