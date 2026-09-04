'use server'

import { SLOTS } from '@/config/slots'
import { requireUser } from '@/lib/auth'
import { fail, ok, type Result } from '@/lib/result'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Slot } from '@/rules/types'
import { levelAtTime, levelName } from '@/actions/roulette-helpers'

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
