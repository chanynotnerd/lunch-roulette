'use server'

import { requireUser } from '@/lib/auth'
import { fail, ok, type Result } from '@/lib/result'
import { createAdminClient } from '@/lib/supabase/admin'
import { toMarkers, toRecordRows, type JoinedRow } from '@/actions/records-helpers'
import { SEOUL_CITY_HALL, type LatLng, type RecordsScreenData } from '@/actions/records-types'

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
