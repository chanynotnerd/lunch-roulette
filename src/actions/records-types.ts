import type { LatLng } from '@/places/types'
import type { Slot } from '@/rules/types'

export type { LatLng }

/** 날짜별 기록 한 줄. 스펙 07 S4. restaurantId는 목록 항목 탭 → 마커 선택에 쓴다(스펙 16). */
export type RecordRow = {
  slotDate: string
  slot: Slot
  slotLabel: string
  placeName: string
  restaurantId: string
  restaurantName: string
  levelAtThatTime: number
  levelName: string
}

/** 식당 하나 = 마커 하나. 스펙 16 M1. visits는 그 식당의 confirmed 행 수(= 경험치). */
export type MapMarker = {
  restaurantId: string
  name: string
  address: string
  lat: number
  lng: number
  visits: number
  level: number
  levelName: string
  /** 마지막 confirmed 행의 slot_date (YYYY-MM-DD) */
  lastVisitDate: string
}

/** 지도를 처음 열 때 보여 줄 범위. 스펙 16 M4. zoom은 카카오 확대 단계(작을수록 가깝다). */
export type InitialView =
  | { kind: 'center'; center: LatLng; zoom: number }
  | { kind: 'bounds'; points: LatLng[] }

/** loadRecordsScreen이 돌려주는 것. 페이지가 그대로 RecordsScreen에 넘긴다. */
export type RecordsScreenData = {
  records: RecordRow[]
  markers: MapMarker[]
  /** 기록이 없을 때 지도 중심. 첫 장소 좌표, 없으면 서울시청. */
  fallbackCenter: LatLng
}

/** 장소도 없을 때 쓰는 기본 중심. 스펙 16 M4. */
export const SEOUL_CITY_HALL: LatLng = { lat: 37.5665, lng: 126.978 }
