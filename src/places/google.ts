import { toHours, type GoogleOpeningHours } from './convert'
import { distanceMeters } from './distance'
import { fetchExternalJson, finiteNumber, isRecord } from './http'
import { ExternalApiError, type FoundRestaurant, type LatLng } from './types'

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new ExternalApiError('GOOGLE_MAPS_API_KEY is not set')
  return key
}

export async function geocode(address: string): Promise<LatLng | null> {
  const url =
    'https://maps.googleapis.com/maps/api/geocode/json' +
    `?address=${encodeURIComponent(address)}&language=ko&region=kr&key=${apiKey()}`
  const json = await fetchExternalJson('Geocoding', url)
  if (!isRecord(json) || typeof json.status !== 'string') {
    throw new ExternalApiError('Geocoding unexpected response shape')
  }
  if (json.status === 'ZERO_RESULTS') return null
  const results = Array.isArray(json.results) ? json.results : []
  if (json.status !== 'OK' || results.length === 0) {
    const detail = typeof json.error_message === 'string' ? json.error_message : ''
    throw new ExternalApiError(`Geocoding status ${json.status}: ${detail}`)
  }
  const first = results[0]
  const geometry = isRecord(first) && isRecord(first.geometry) ? first.geometry : null
  const location = geometry && isRecord(geometry.location) ? geometry.location : null
  const lat = location ? finiteNumber(location.lat) : null
  const lng = location ? finiteNumber(location.lng) : null
  if (lat === null || lng === null) throw new ExternalApiError('Geocoding unexpected response shape')
  return { lat, lng }
}

const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.regularOpeningHours,nextPageToken'
const MAX_PAGES = 3

type SearchPage = { places: Record<string, unknown>[]; nextPageToken: string | undefined }

/** 최상위 형태 검증: places 는 배열이어야 한다 (없으면 빈 배열로 본다). */
function parseSearchPage(json: unknown): SearchPage {
  if (!isRecord(json)) throw new ExternalApiError('Places searchText unexpected response shape')
  if (json.places !== undefined && !Array.isArray(json.places)) {
    throw new ExternalApiError('Places searchText unexpected response shape')
  }
  const places = Array.isArray(json.places) ? json.places.filter(isRecord) : []
  const nextPageToken = typeof json.nextPageToken === 'string' && json.nextPageToken ? json.nextPageToken : undefined
  return { places, nextPageToken }
}

export async function searchRestaurants(center: LatLng, radiusM: number): Promise<FoundRestaurant[]> {
  const key = apiKey()
  const seen = new Set<string>()
  const found: FoundRestaurant[] = []
  let pageToken: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      textQuery: '음식점',
      includedType: 'restaurant',
      languageCode: 'ko',
      regionCode: 'KR',
      pageSize: 20,
      locationBias: {
        circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusM },
      },
    }
    if (pageToken) body.pageToken = pageToken

    const json = await fetchExternalJson('Places searchText', 'https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    })
    const { places, nextPageToken } = parseSearchPage(json)

    for (const p of places) {
      if (typeof p.id !== 'string' || p.id === '' || seen.has(p.id)) continue
      const location = isRecord(p.location) ? p.location : null
      const lat = location ? finiteNumber(location.latitude) : null
      const lng = location ? finiteNumber(location.longitude) : null
      if (lat === null || lng === null) continue
      // Text Search locationBias is not strict; enforce the radius ourselves.
      if (distanceMeters(center, { lat, lng }) > radiusM) continue
      seen.add(p.id)
      const displayName = isRecord(p.displayName) && typeof p.displayName.text === 'string' ? p.displayName.text : ''
      const hours = toHours(isRecord(p.regularOpeningHours) ? (p.regularOpeningHours as GoogleOpeningHours) : null)
      found.push({
        google_place_id: p.id,
        name: displayName,
        address: typeof p.formattedAddress === 'string' ? p.formattedAddress : '',
        lat,
        lng,
        hours,
        hours_source: hours ? 'google' : 'none',
      })
    }

    pageToken = nextPageToken
    if (!pageToken) break
  }

  return found
}
