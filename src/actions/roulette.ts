'use server'

import { revalidatePath } from 'next/cache'
import { SLOTS } from '@/config/slots'
import { requireUser } from '@/lib/auth'
import { fail, ok, type Result } from '@/lib/result'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOpenAt } from '@/rules/hours'
import { pickCandidates } from '@/rules/pick'
import { getSlot, isAnyTimeMode, nextSlotStart } from '@/rules/slot'
import type { Slot } from '@/rules/types'
import {
  countXp,
  isLevelUp,
  nextSlotAfter,
  toCandidate,
  type Candidate,
  type RestaurantRow,
} from '@/actions/roulette-helpers'

export type { Candidate } from '@/actions/roulette-helpers'

export type HomeState =
  | { kind: 'no_place' }
  | { kind: 'outside'; nextSlotAt: string }
  | { kind: 'not_enough'; count: number; slotLabel: string }
  | { kind: 'idle'; slotLabel: string }
  | {
      kind: 'open'
      sessionId: string
      slotLabel: string
      candidates: Candidate[]
      rerollUsed: boolean
      poolNames: string[]
    }
  | { kind: 'confirmed'; slotLabel: string; chosen: Candidate; nextSlotAt: string; leveledUp: boolean }

type Admin = ReturnType<typeof createAdminClient>

type SessionRow = {
  id: string
  user_id: string
  /** 장소가 삭제되면 null (0003, 스펙 06 F3) */
  place_id: string | null
  slot_date: string
  slot: Slot
  candidate_ids: string[]
  reroll_used: boolean
  chosen_restaurant_id: string | null
  status: 'open' | 'confirmed'
  confirmed_at: string | null
}

// ---------------------------------------------------------------
// 조회 헬퍼 (모두 admin 클라이언트. 소유권은 호출부에서 확인한다)
// ---------------------------------------------------------------

async function ownsPlace(admin: Admin, userId: string, placeId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('places')
    .select('id')
    .eq('id', placeId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

/** 장소에 연결된 식당 중 지금 영업 중인 식당(후보 풀). */
async function getOpenPool(admin: Admin, placeId: string, now: Date): Promise<RestaurantRow[]> {
  const { data, error } = await admin
    .from('place_restaurants')
    .select('restaurants(id, name, address, hours)')
    .eq('place_id', placeId)
  if (error) throw error
  const rows = (data ?? []) as unknown as { restaurants: RestaurantRow | RestaurantRow[] | null }[]
  const pool: RestaurantRow[] = []
  for (const r of rows) {
    const rest = Array.isArray(r.restaurants) ? r.restaurants[0] : r.restaurants
    if (rest && isOpenAt(rest.hours, now)) pool.push(rest)
  }
  return pool
}

async function getRestaurants(admin: Admin, ids: string[]): Promise<Map<string, RestaurantRow>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await admin.from('restaurants').select('id, name, address, hours').in('id', ids)
  if (error) throw error
  return new Map(((data ?? []) as RestaurantRow[]).map((r) => [r.id, r]))
}

/** 식당별 경험치. 쿼리 한 번으로 confirmed 행을 읽어 JS에서 센다. */
async function getXpMap(admin: Admin, userId: string, restaurantIds: string[]): Promise<Map<string, number>> {
  if (restaurantIds.length === 0) return new Map()
  const { data, error } = await admin
    .from('roulette_sessions')
    .select('chosen_restaurant_id')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .in('chosen_restaurant_id', restaurantIds)
  if (error) throw error
  return countXp((data ?? []) as { chosen_restaurant_id: string | null }[], restaurantIds)
}

async function getSessionForSlot(
  admin: Admin,
  userId: string,
  slotDate: string,
  slot: Slot,
): Promise<SessionRow | null> {
  const { data, error } = await admin
    .from('roulette_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('slot_date', slotDate)
    .eq('slot', slot)
    .maybeSingle()
  if (error) throw error
  return (data as SessionRow | null) ?? null
}

async function getSessionById(admin: Admin, userId: string, sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await admin
    .from('roulette_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as SessionRow | null) ?? null
}

// ---------------------------------------------------------------
// 상태 조립
// ---------------------------------------------------------------

/** candidate_ids 순서를 지켜 후보 카드를 만든다. */
async function buildCandidates(admin: Admin, userId: string, ids: string[]): Promise<Candidate[]> {
  const [rests, xp] = await Promise.all([getRestaurants(admin, ids), getXpMap(admin, userId, ids)])
  const out: Candidate[] = []
  for (const id of ids) {
    const row = rests.get(id)
    if (row) out.push(toCandidate(row, xp.get(id) ?? 0))
  }
  return out
}

async function stateFromSession(admin: Admin, userId: string, session: SessionRow, now: Date): Promise<HomeState> {
  const slotLabel = SLOTS[session.slot].label
  if (session.status === 'confirmed' && session.chosen_restaurant_id) {
    const [chosen] = await buildCandidates(admin, userId, [session.chosen_restaurant_id])
    if (!chosen) throw new Error(`chosen restaurant missing: ${session.chosen_restaurant_id}`)
    return {
      kind: 'confirmed',
      slotLabel,
      chosen,
      nextSlotAt: nextSlotAfter(session.slot, now),
      // chosen.xp는 이번 확정을 포함한 누적 횟수다.
      leveledUp: isLevelUp(chosen.xp),
    }
  }
  const [candidates, pool] = await Promise.all([
    buildCandidates(admin, userId, session.candidate_ids),
    // 열린 세션의 장소가 삭제된 경우 풀은 비어 있다. 후보 카드는 그대로 보여 확정은 가능하다.
    session.place_id ? getOpenPool(admin, session.place_id, now) : Promise.resolve([] as RestaurantRow[]),
  ])
  return {
    kind: 'open',
    sessionId: session.id,
    slotLabel,
    candidates,
    rerollUsed: session.reroll_used && !isAnyTimeMode(),
    poolNames: pool.map((r) => r.name),
  }
}

async function computeHomeState(admin: Admin, userId: string, placeId: string, now: Date): Promise<Result<HomeState>> {
  if (!(await ownsPlace(admin, userId, placeId))) return fail('PLACE_FORBIDDEN')

  const cur = getSlot(now)
  if (!cur) return ok({ kind: 'outside', nextSlotAt: nextSlotStart(now) })
  const slotLabel = SLOTS[cur.slot].label

  const session = await getSessionForSlot(admin, userId, cur.slotDate, cur.slot)
  if (session) return ok(await stateFromSession(admin, userId, session, now))

  const pool = await getOpenPool(admin, placeId, now)
  if (pool.length < 3) return ok({ kind: 'not_enough', count: pool.length, slotLabel })
  return ok({ kind: 'idle', slotLabel })
}

function unexpected(where: string, e: unknown): Result<never> {
  console.error(`[roulette] ${where}`, e)
  return fail('UNEXPECTED')
}

/** 세션의 슬롯이 지금도 진행 중인지. */
function isSessionSlotCurrent(session: SessionRow, now: Date): boolean {
  const cur = getSlot(now)
  return !!cur && cur.slot === session.slot && cur.slotDate === session.slot_date
}

// ---------------------------------------------------------------
// 서버 액션
// ---------------------------------------------------------------

export async function getHomeState(placeId: string | null): Promise<Result<HomeState>> {
  const now = new Date()
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED')
  if (!placeId) return ok({ kind: 'no_place' })
  try {
    return await computeHomeState(createAdminClient(), user.id, placeId, now)
  } catch (e) {
    return unexpected('getHomeState', e)
  }
}

/** F4. 돌리기: 후보 3개를 뽑아 open 세션을 만든다. */
export async function spin(placeId: string): Promise<Result<HomeState>> {
  const now = new Date()
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED')
  try {
    const admin = createAdminClient()
    const cur = getSlot(now)
    if (!cur) return fail('OUTSIDE_SLOT', { time: nextSlotStart(now) })
    if (!(await ownsPlace(admin, user.id, placeId))) return fail('PLACE_FORBIDDEN')

    const existing = await getSessionForSlot(admin, user.id, cur.slotDate, cur.slot)
    if (existing) return ok(await stateFromSession(admin, user.id, existing, now))

    const pool = await getOpenPool(admin, placeId, now)
    if (pool.length < 3) return fail('NOT_ENOUGH_OPEN', { count: pool.length })

    const candidateIds = pickCandidates(pool).map((r) => r.id)
    const { data, error } = await admin
      .from('roulette_sessions')
      .insert({
        user_id: user.id,
        place_id: placeId,
        slot_date: cur.slotDate,
        slot: cur.slot,
        candidate_ids: candidateIds,
        status: 'open',
      })
      .select('*')
      .single()

    let session: SessionRow | null = (data as SessionRow | null) ?? null
    if (error) {
      // 두 번 빠르게 눌러 유일 제약에 걸리면 기존 세션을 돌려준다. (스펙 06 F4, 08)
      if (error.code !== '23505') throw error
      session = await getSessionForSlot(admin, user.id, cur.slotDate, cur.slot)
      if (!session) throw error
    }
    if (!session) throw new Error('insert returned no row')

    revalidatePath('/')
    return ok(await stateFromSession(admin, user.id, session, now))
  } catch (e) {
    return unexpected('spin', e)
  }
}

/** F5. 다시 돌리기: 한 번만, open 세션에서만. 풀이 부족하면 세션을 건드리지 않는다. */
export async function reroll(sessionId: string): Promise<Result<HomeState>> {
  const now = new Date()
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED')
  try {
    const admin = createAdminClient()
    const session = await getSessionById(admin, user.id, sessionId)
    if (!session || session.status !== 'open') return fail('SESSION_NOT_OPEN')
    // 테스트 모드(ROULETTE_ALLOW_ANY_TIME)에서는 다시 돌리기 횟수 제한을 두지 않는다.
    if (session.reroll_used && !isAnyTimeMode()) return fail('REROLL_ALREADY_USED')
    if (!isSessionSlotCurrent(session, now)) return fail('OUTSIDE_SLOT', { time: nextSlotStart(now) })
    // 장소가 삭제된 세션은 다시 돌릴 풀이 없다.
    if (!session.place_id) return fail('PLACE_FORBIDDEN')

    const pool = await getOpenPool(admin, session.place_id, now)
    if (pool.length < 3) return fail('NOT_ENOUGH_OPEN', { count: pool.length })

    const candidateIds = pickCandidates(pool).map((r) => r.id)
    const { data, error } = await admin
      .from('roulette_sessions')
      .update({ candidate_ids: candidateIds, reroll_used: true })
      .eq('id', session.id)
      .eq('status', 'open')
      .eq('reroll_used', isAnyTimeMode() ? session.reroll_used : false)
      .select('*')
    if (error) throw error
    const updated = (data as SessionRow[] | null)?.[0]
    if (!updated) {
      // 그 사이 확정되었거나 다른 요청이 먼저 다시 돌렸다.
      const latest = await getSessionById(admin, user.id, sessionId)
      if (!latest || latest.status !== 'open') return fail('SESSION_NOT_OPEN')
      return fail('REROLL_ALREADY_USED')
    }

    revalidatePath('/')
    return ok(await stateFromSession(admin, user.id, updated, now))
  } catch (e) {
    return unexpected('reroll', e)
  }
}

/** F6. 확정: 후보 중 하나를 골라 세션을 confirmed로 바꾼다. 갱신 조건에 status = open을 넣어 두 번 눌러도 한 번만 반영한다. */
export async function confirm(sessionId: string, restaurantId: string): Promise<Result<HomeState>> {
  const now = new Date()
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED')
  try {
    const admin = createAdminClient()
    const session = await getSessionById(admin, user.id, sessionId)
    if (!session || session.status !== 'open') return fail('SESSION_NOT_OPEN')
    if (!session.candidate_ids.includes(restaurantId)) return fail('NOT_A_CANDIDATE')
    if (!isSessionSlotCurrent(session, now)) return fail('OUTSIDE_SLOT', { time: nextSlotStart(now) })

    const { data, error } = await admin
      .from('roulette_sessions')
      .update({ chosen_restaurant_id: restaurantId, status: 'confirmed', confirmed_at: now.toISOString() })
      .eq('id', session.id)
      .eq('status', 'open')
      .select('*')
    if (error) throw error
    const updated = (data as SessionRow[] | null)?.[0]
    if (!updated) return fail('SESSION_NOT_OPEN')

    revalidatePath('/')
    return ok(await stateFromSession(admin, user.id, updated, now))
  } catch (e) {
    return unexpected('confirm', e)
  }
}
