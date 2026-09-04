import { distanceMeters } from './distance'
import { fetchExternalJson, finiteNumber, isRecord } from './http'
import { ExternalApiError, type FoundRestaurant, type LatLng } from './types'
import { DEFAULT_HOURS } from '@/config/default-hours'

/**
 * 카카오 로컬 API 어댑터 (스펙 09 대안, D17).
 * - 주소 → 좌표: /v2/local/search/address.json, 실패 시 /v2/local/search/keyword.json
 * - 식당 검색: /v2/local/search/keyword.json, category_group_code=FD6, 반경 radius, 페이지당 15개, 최대 3페이지
 * 카카오는 영업시간을 주지 않으므로 hours 는 DEFAULT_HOURS 를 넣고 hours_source 를 'default' 로 표시한다.
 * 정확한 영업시간은 data/hours-overrides.json 으로 덮어쓴다. (스펙 10)
 * 저장 키는 `kakao:<id>` 형식이다.
 */

const MAX_PAGES = 3

function apiKey(): string {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key) throw new ExternalApiError('KAKAO_REST_API_KEY is not set')
  return key
}

type KakaoPage = { documents: Record<string, unknown>[]; isEnd: boolean }

/** 최상위 형태 검증: documents 가 배열이어야 한다. meta.is_end 는 없으면 true 로 본다(더 요청하지 않음). */
function parsePage(path: string, json: unknown): KakaoPage {
  if (!isRecord(json) || !Array.isArray(json.documents)) {
    throw new ExternalApiError(`Kakao ${path} unexpected response shape`)
  }
  const meta = isRecord(json.meta) ? json.meta : null
  const isEnd = meta?.is_end === undefined ? true : meta.is_end === true
  return { documents: json.documents.filter(isRecord), isEnd }
}

async function kakaoGet(path: string, params: Record<string, string | number>): Promise<KakaoPage> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  const json = await fetchExternalJson(`Kakao ${path}`, `https://dapi.kakao.com${path}?${qs}`, {
    headers: { Authorization: `KakaoAK ${apiKey()}` },
  })
  return parsePage(path, json)
}

/** 카카오 문서의 x(경도)/y(위도) 문자열을 좌표로. 유한하지 않으면 null. */
function toLatLng(doc: Record<string, unknown>): LatLng | null {
  const lat = finiteNumber(doc.y)
  const lng = finiteNumber(doc.x)
  if (lat === null || lng === null) return null
  return { lat, lng }
}

export async function geocode(address: string): Promise<LatLng | null> {
  const byAddress = await kakaoGet('/v2/local/search/address.json', { query: address, size: 1 })
  const a = byAddress.documents[0]
  if (a) {
    const point = toLatLng(a)
    if (point) return point
  }

  const byKeyword = await kakaoGet('/v2/local/search/keyword.json', { query: address, size: 1 })
  const k = byKeyword.documents[0]
  if (k) return toLatLng(k)
  return null
}

export async function searchRestaurants(center: LatLng, radiusM: number): Promise<FoundRestaurant[]> {
  const seen = new Map<string, FoundRestaurant>()
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await kakaoGet('/v2/local/search/keyword.json', {
      query: '음식점',
      category_group_code: 'FD6',
      x: center.lng,
      y: center.lat,
      radius: Math.min(Math.max(radiusM, 0), 20000),
      size: 15,
      page,
      sort: 'distance',
    })
    for (const p of res.documents) {
      if (typeof p.id !== 'string' || p.id === '') continue
      const point = toLatLng(p)
      if (!point) continue
      if (distanceMeters(center, point) > radiusM) continue
      const id = `kakao:${p.id}`
      if (seen.has(id)) continue
      seen.set(id, {
        google_place_id: id,
        name: typeof p.place_name === 'string' ? p.place_name : '',
        address:
          (typeof p.road_address_name === 'string' && p.road_address_name) ||
          (typeof p.address_name === 'string' && p.address_name) ||
          '',
        lat: point.lat,
        lng: point.lng,
        hours: DEFAULT_HOURS,
        hours_source: 'default',
      })
    }
    if (res.isEnd) break
  }
  return [...seen.values()]
}
