'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { fail, ok, type Result } from '@/lib/result'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocode, searchRestaurants } from '@/places/search'
import { ExternalApiError } from '@/places/types'
import { isUuid, validatePlaceInput } from '@/actions/places-helpers'

export type PlaceSummary = {
  id: string
  name: string
  address: string
  radius_m: number
  restaurant_count: number
}

export type PlaceRestaurant = {
  id: string
  name: string
  address: string
  has_hours: boolean
}

const RADIUS_MIN = 100
const RADIUS_MAX = 2000
const RADIUS_DEFAULT = 500

function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return RADIUS_DEFAULT
  return Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(value)))
}

function revalidate(): void {
  revalidatePath('/places')
  revalidatePath('/')
}

/** 장소 소유권 확인. 없거나 남의 것이면 PLACE_FORBIDDEN. UUID 형식이 아니어도 같은 코드로 거절한다. */
async function assertOwner(
  admin: ReturnType<typeof createAdminClient>,
  placeId: string,
  userId: string,
): Promise<Result<null>> {
  if (!isUuid(placeId)) return fail('PLACE_FORBIDDEN')
  const { data, error } = await admin
    .from('places')
    .select('user_id')
    .eq('id', placeId)
    .maybeSingle()
  if (error) throw error
  if (!data || data.user_id !== userId) return fail('PLACE_FORBIDDEN')
  return ok(null)
}

export async function listPlaces(): Promise<Result<PlaceSummary[]>> {
  try {
    const user = await requireUser()
    if (!user) return fail('AUTH_REQUIRED')
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('places')
      .select('id, name, address, radius_m, place_restaurants(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as unknown as {
      id: string
      name: string
      address: string
      radius_m: number
      place_restaurants: { count: number }[] | null
    }[]
    return ok(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        radius_m: r.radius_m,
        restaurant_count: r.place_restaurants?.[0]?.count ?? 0,
      })),
    )
  } catch (e) {
    console.error('[listPlaces]', e)
    return fail('UNEXPECTED')
  }
}

export async function listPlaceRestaurants(placeId: string): Promise<Result<PlaceRestaurant[]>> {
  try {
    const user = await requireUser()
    if (!user) return fail('AUTH_REQUIRED')
    const admin = createAdminClient()
    const owned = await assertOwner(admin, placeId, user.id)
    if (!owned.ok) return owned

    const { data, error } = await admin
      .from('place_restaurants')
      .select('restaurants(id, name, address, hours)')
      .eq('place_id', placeId)
    if (error) throw error
    const rows = (data ?? []) as unknown as {
      restaurants: { id: string; name: string; address: string; hours: unknown } | null
    }[]
    const list = rows
      .map((r) => r.restaurants)
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        has_hours: r.hours !== null && r.hours !== undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    return ok(list)
  } catch (e) {
    console.error('[listPlaceRestaurants]', e)
    return fail('UNEXPECTED')
  }
}

export async function createPlace(input: {
  name: string
  address: string
  radiusM: number
}): Promise<Result<{ placeId: string; restaurantCount: number }>> {
  try {
    const user = await requireUser()
    if (!user) return fail('AUTH_REQUIRED')

    const valid = validatePlaceInput(input)
    if (!valid.ok) return valid
    const { name, address } = valid.data
    const radiusM = clampRadius(Number(input.radiusM))

    const admin = createAdminClient()

    const { data: dup, error: dupError } = await admin
      .from('places')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name)
      .maybeSingle()
    if (dupError) throw dupError
    if (dup) return fail('PLACE_NAME_DUPLICATE')

    let center: Awaited<ReturnType<typeof geocode>>
    let restaurants: Awaited<ReturnType<typeof searchRestaurants>>
    try {
      center = await geocode(address)
      if (!center) return fail('GEOCODE_NOT_FOUND')
      restaurants = await searchRestaurants(center, radiusM)
    } catch (e) {
      if (e instanceof ExternalApiError) {
        console.error('[createPlace] external api', e.message, e.status ?? '')
        return fail('EXTERNAL_API_UNAVAILABLE')
      }
      throw e
    }

    const { data: placeId, error: rpcError } = await admin.rpc('create_place_with_restaurants', {
      p_user_id: user.id,
      p_name: name,
      p_address: address,
      p_lat: center.lat,
      p_lng: center.lng,
      p_radius_m: radiusM,
      p_restaurants: restaurants,
    })
    if (rpcError) {
      // 동시 생성으로 (user_id, name) 유일 제약에 걸린 경우
      if (rpcError.code === '23505') return fail('PLACE_NAME_DUPLICATE')
      throw rpcError
    }

    revalidate()
    return ok({ placeId: String(placeId), restaurantCount: restaurants.length })
  } catch (e) {
    console.error('[createPlace]', e)
    return fail('UNEXPECTED')
  }
}

export async function deletePlace(placeId: string): Promise<Result<null>> {
  try {
    const user = await requireUser()
    if (!user) return fail('AUTH_REQUIRED')
    const admin = createAdminClient()
    const owned = await assertOwner(admin, placeId, user.id)
    if (!owned.ok) return owned

    // place_restaurants 는 FK cascade 로 함께 삭제되고, 식당 행은 남는다. (F3)
    // roulette_sessions 는 남고 place_id 만 null 이 된다. (0003_sessions_place_nullable.sql)
    const { error } = await admin.from('places').delete().eq('id', placeId).eq('user_id', user.id)
    if (error) throw error

    revalidate()
    return ok(null)
  } catch (e) {
    console.error('[deletePlace]', e)
    return fail('UNEXPECTED')
  }
}
