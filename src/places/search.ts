import 'server-only'

import type { FoundRestaurant, LatLng } from './types'
import * as google from './google'
import * as kakao from './kakao'

/**
 * 식당 검색 소스 선택. PLACES_PROVIDER=google|kakao. 미설정이면 KAKAO_REST_API_KEY 가 있을 때 kakao, 아니면 google.
 * 서버 액션은 이 모듈만 import 한다. (스펙 03 모듈 경계, 12 소스 교체)
 */
export type PlacesProvider = 'google' | 'kakao'

export function currentProvider(): PlacesProvider {
  const p = process.env.PLACES_PROVIDER
  if (p === 'google' || p === 'kakao') return p
  return process.env.KAKAO_REST_API_KEY ? 'kakao' : 'google'
}

export async function geocode(address: string): Promise<LatLng | null> {
  return currentProvider() === 'kakao' ? kakao.geocode(address) : google.geocode(address)
}

export async function searchRestaurants(center: LatLng, radiusM: number): Promise<FoundRestaurant[]> {
  return currentProvider() === 'kakao'
    ? kakao.searchRestaurants(center, radiusM)
    : google.searchRestaurants(center, radiusM)
}
