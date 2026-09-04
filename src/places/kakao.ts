import { distanceMeters } from './distance'
import { ExternalApiError, type FoundRestaurant, type LatLng } from './types'
import { DEFAULT_HOURS } from '@/config/default-hours'

/**
 * 카카오 로컬 API 어댑터 (스펙 09 대안, D17).
 * - 주소 → 좌표: /v2/local/search/address.json, 실패 시 /v2/local/search/keyword.json
 * - 식당 검색: /v2/local/search/keyword.json, category_group_code=FD6, 반경 radius, 페이지당 15개, 최대 3페이지
 * 카카오는 영업시간을 주지 않으므로 hours 는 DEFAULT_HOURS 를 넣고 hours_source 를 'default' 로 표시한다.
 * 정확한 영업시간은 data/hours-overrides.json 으로 덮어쓴다. (스펙 10)
 */

function apiKey(): string {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key) throw new ExternalApiError('KAKAO_REST_API_KEY is not set')
  return key
}

async function kakaoGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  const res = await fetch(`https://dapi.kakao.com${path}?${qs}`, {
    headers: { Authorization: `KakaoAK ${apiKey()}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ExternalApiError(`Kakao ${path} HTTP ${res.status}: ${body.slice(0, 200)}`, res.status)
  }
  return (await res.json()) as T
}

type KakaoDoc = { x: string; y: string }
type KakaoPage<T> = { documents: T[]; meta: { is_end: boolean; total_count: number } }

export async function geocode(address: string): Promise<LatLng | null> {
  const byAddress = await kakaoGet<KakaoPage<KakaoDoc>>('/v2/local/search/address.json', {
    query: address,
    size: 1,
  })
  const a = byAddress.documents[0]
  if (a) return { lat: Number(a.y), lng: Number(a.x) }

  const byKeyword = await kakaoGet<KakaoPage<KakaoDoc>>('/v2/local/search/keyword.json', {
    query: address,
    size: 1,
  })
  const k = byKeyword.documents[0]
  if (k) return { lat: Number(k.y), lng: Number(k.x) }
  return null
}

type KakaoPlace = {
  id: string
  place_name: string
  road_address_name?: string
  address_name?: string
  x: string
  y: string
}

export async function searchRestaurants(center: LatLng, radiusM: number): Promise<FoundRestaurant[]> {
  const seen = new Map<string, FoundRestaurant>()
  for (let page = 1; page <= 3; page++) {
    const res = await kakaoGet<KakaoPage<KakaoPlace>>('/v2/local/search/keyword.json', {
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
      const lat = Number(p.y)
      const lng = Number(p.x)
      if (distanceMeters(center, { lat, lng }) > radiusM) continue
      const id = `kakao:${p.id}`
      if (seen.has(id)) continue
      seen.set(id, {
        google_place_id: id,
        name: p.place_name,
        address: p.road_address_name || p.address_name || '',
        lat,
        lng,
        hours: DEFAULT_HOURS,
        hours_source: 'default',
      })
    }
    if (res.meta.is_end) break
  }
  return [...seen.values()]
}
