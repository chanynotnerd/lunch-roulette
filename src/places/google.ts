import { toHours, type GoogleOpeningHours } from './convert'
import { distanceMeters } from './distance'
import { ExternalApiError, type FoundRestaurant, type LatLng } from './types'

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new ExternalApiError('GOOGLE_MAPS_API_KEY is not set')
  return key
}

type GeocodeResponse = {
  status: string
  error_message?: string
  results?: { geometry: { location: { lat: number; lng: number } } }[]
}

export async function geocode(address: string): Promise<LatLng | null> {
  const url =
    'https://maps.googleapis.com/maps/api/geocode/json' +
    `?address=${encodeURIComponent(address)}&language=ko&region=kr&key=${apiKey()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new ExternalApiError(`Geocoding HTTP ${res.status}`, res.status)
  const json = (await res.json()) as GeocodeResponse
  if (json.status === 'ZERO_RESULTS') return null
  if (json.status !== 'OK' || !json.results?.length) {
    throw new ExternalApiError(`Geocoding status ${json.status}: ${json.error_message ?? ''}`)
  }
  const { lat, lng } = json.results[0].geometry.location
  return { lat, lng }
}

type GPlace = {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  regularOpeningHours?: GoogleOpeningHours
}

type SearchTextResponse = { places?: GPlace[]; nextPageToken?: string }

const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.regularOpeningHours,nextPageToken'
const MAX_PAGES = 3

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

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ExternalApiError(
        `Places searchText HTTP ${res.status}: ${text.slice(0, 200)}`,
        res.status,
      )
    }
    const json = (await res.json()) as SearchTextResponse

    for (const p of json.places ?? []) {
      if (!p.id || !p.location || seen.has(p.id)) continue
      const lat = p.location.latitude
      const lng = p.location.longitude
      // Text Search locationBias is not strict; enforce the radius ourselves.
      if (distanceMeters(center, { lat, lng }) > radiusM) continue
      seen.add(p.id)
      const hours = toHours(p.regularOpeningHours)
      found.push({
        google_place_id: p.id,
        name: p.displayName?.text ?? '',
        address: p.formattedAddress ?? '',
        lat,
        lng,
        hours,
        hours_source: hours ? 'google' : 'none',
      })
    }

    pageToken = json.nextPageToken
    if (!pageToken) break
  }

  return found
}
