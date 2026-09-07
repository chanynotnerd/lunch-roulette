'use server'

import { SLOTS } from '@/config/slots'
import { requireUser } from '@/lib/auth'
import { fail, ok, type Result } from '@/lib/result'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Slot } from '@/rules/types'
import { levelAtTime, levelName } from '@/actions/roulette-helpers'
import { toMarkers, toRecordRows, type JoinedRow } from '@/actions/records-helpers'
import { SEOUL_CITY_HALL, type LatLng, type RecordsScreenData } from '@/actions/records-types'

export type RecordRow = {
  slotDate: string
  slot: Slot
  slotLabel: string
  placeName: string
  restaurantName: string
  levelAtThatTime: number
  levelName: string
}

type Joined = {
  slot_date: string
  slot: Slot
  chosen_restaurant_id: string | null
  confirmed_at: string | null
  places: { name: string } | { name: string }[] | null
  restaurants: { name: string } | { name: string }[] | null
}

const DELETED_PLACE = '삭제된 장소'

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/**
 * F8. 본인의 confirmed 세션을 slot_date desc, slot desc(저녁이 점심보다 앞)로.
 * 확정 당시 레벨은 같은 식당의 confirmed_at ≤ 이 행 시각인 행 수로 계산한다. 쿼리는 한 번.
 */
export async function listRecords(): Promise<Result<RecordRow[]>> {
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED')
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('roulette_sessions')
      .select('slot_date, slot, chosen_restaurant_id, confirmed_at, places(name), restaurants(name)')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .order('slot_date', { ascending: false })
      .order('slot', { ascending: false })
    if (error) throw error

    const rows = (data ?? []) as unknown as Joined[]
    const out: RecordRow[] = []
    for (const r of rows) {
      if (!r.chosen_restaurant_id || !r.confirmed_at) continue
      const level = levelAtTime(rows, r.chosen_restaurant_id, r.confirmed_at)
      out.push({
        slotDate: r.slot_date,
        slot: r.slot,
        slotLabel: SLOTS[r.slot].label,
        placeName: one(r.places)?.name ?? DELETED_PLACE,
        restaurantName: one(r.restaurants)?.name ?? '',
        levelAtThatTime: level,
        levelName: levelName(level),
      })
    }
    return ok(out)
  } catch (e) {
    console.error('[records] listRecords', e)
    return fail('UNEXPECTED')
  }
}

const SCREEN_SELECT =
  'slot_date, slot, chosen_restaurant_id, confirmed_at, places(name), restaurants(id, name, address, lat, lng)'

/**
 * 스펙 16. 기록 화면 데이터. confirmed 세션을 한 번 조회해 날짜별 목록과 식당별 마커를 만든다.
 * fallbackCenter는 첫 장소 좌표, 없으면 서울시청. 브라우저는 이 결과만 받고 DB를 직접 부르지 않는다.
 */
export async function loadRecordsScreen(): Promise<Result<RecordsScreenData>> {
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED')
  try {
    const admin = createAdminClient()
    const [sessions, firstPlace] = await Promise.all([
      admin
        .from('roulette_sessions')
        .select(SCREEN_SELECT)
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .order('slot_date', { ascending: false })
        .order('slot', { ascending: false }),
      admin
        .from('places')
        .select('lat, lng')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])
    if (sessions.error) throw sessions.error
    if (firstPlace.error) throw firstPlace.error

    const rows = (sessions.data ?? []) as unknown as JoinedRow[]
    const place = firstPlace.data as { lat: number; lng: number } | null
    const fallbackCenter: LatLng =
      place && Number.isFinite(place.lat) && Number.isFinite(place.lng)
        ? { lat: place.lat, lng: place.lng }
        : SEOUL_CITY_HALL

    return ok({ records: toRecordRows(rows), markers: toMarkers(rows), fallbackCenter })
  } catch (e) {
    console.error('[records] loadRecordsScreen', e)
    return fail('UNEXPECTED')
  }
}
