import type { Hours } from '@/rules/types'

export type LatLng = { lat: number; lng: number }

export type FoundRestaurant = {
  google_place_id: string
  name: string
  address: string
  lat: number
  lng: number
  hours: Hours | null
  hours_source: 'google' | 'none'
}

export class ExternalApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
    this.name = 'ExternalApiError'
  }
}
