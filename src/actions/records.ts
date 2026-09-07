'use server'

import { requireUser } from '@/lib/auth'
import { fail, ok, type Result } from '@/lib/result'
import { createAdminClient } from '@/lib/supabase/admin'
import { toMarkers, toPlaceMarkers, toRecordRows, type JoinedRow, type PlaceRow } from '@/actions/records-helpers'
import { SEOUL_CITY_HALL, type LatLng, type RecordsScreenData } from '@/actions/records-types'

const SCREEN_SELECT =
  'slot_date, slot, chosen_restaurant_id, confirmed_at, places(name), restaurants(id, name, address, lat, lng)'

/**
 * 스펙 16. 기록 화면 데이터. confirmed 세션을 한 번 조회해 날짜별 목록과 식당별 마커를 만들고,
 * 사용자의 장소 전부를 장소 마커로 내려준다. fallbackCenter는 첫 장소 좌표, 없으면 서울시청.
 * 브라우저는 이 결과만 받고 DB를 직접 부르지 않는다.
 */
export async function loadRecordsScreen(): Promise<Result<RecordsScreenData>> {
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED')
  try {
    const admin = createAdminClient()
    const [sessions, placeRows] = await Promise.all([
      admin
        .from('roulette_sessions')
        .select(SCREEN_SELECT)
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .order('slot_date', { ascending: false })
        .order('slot', { ascending: false }),
      admin
        .from('places')
        .select('id, name, lat, lng')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ])
    if (sessions.error) throw sessions.error
    if (placeRows.error) throw placeRows.error

    const rows = (sessions.data ?? []) as unknown as JoinedRow[]
    const places = toPlaceMarkers((placeRows.data ?? []) as unknown as PlaceRow[])
    const first = places[0]
    const fallbackCenter: LatLng = first ? { lat: first.lat, lng: first.lng } : SEOUL_CITY_HALL

    return ok({ records: toRecordRows(rows), markers: toMarkers(rows), places, fallbackCenter })
  } catch (e) {
    console.error('[records] loadRecordsScreen', e)
    return fail('UNEXPECTED')
  }
}
