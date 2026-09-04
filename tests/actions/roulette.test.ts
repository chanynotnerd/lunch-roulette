import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Hours } from '@/rules/types'

// ---------------------------------------------------------------
// 의존성 목킹: 인증, admin 클라이언트, revalidatePath. 액션 시그니처는 그대로 둔다.
// ---------------------------------------------------------------

const requireUserMock = vi.fn()
vi.mock('@/lib/auth', () => ({ requireUser: () => requireUserMock() }))

const createAdminClientMock = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClientMock() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { confirm, getHomeState, reroll, spin } from '@/actions/roulette'

// ---------------------------------------------------------------
// supabase 쿼리 빌더 최소 목. 체이닝을 기록하고 await 시점에 handler로 결과를 만든다.
// ---------------------------------------------------------------

type Op = 'select' | 'insert' | 'update' | 'delete'
type Call = { table: string; op: Op; payload?: unknown; filters: unknown[][]; terminal?: 'single' | 'maybeSingle' }
type DbResult = { data?: unknown; error?: unknown; count?: number | null }
type Handler = (call: Call) => DbResult

function makeAdmin(handler: Handler) {
  const calls: Call[] = []
  const builder = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] }
    calls.push(call)
    const chain: Record<string, unknown> = {}
    const setOp = (op: Op) => (payload?: unknown) => {
      if (op === 'select' && call.op !== 'select') return chain // insert().select('*') 등은 op를 유지
      call.op = op
      if (payload !== undefined) call.payload = payload
      return chain
    }
    chain.select = setOp('select')
    chain.insert = setOp('insert')
    chain.update = setOp('update')
    chain.delete = setOp('delete')
    for (const f of ['eq', 'in', 'contains', 'order']) {
      chain[f] = (...args: unknown[]) => {
        call.filters.push([f, ...args])
        return chain
      }
    }
    chain.single = () => ((call.terminal = 'single'), chain)
    chain.maybeSingle = () => ((call.terminal = 'maybeSingle'), chain)
    chain.then = (onFul: (v: DbResult) => unknown, onRej?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => ({ data: null, error: null, ...handler(call) }))
        .then(onFul, onRej)
    return chain
  }
  return { admin: { from: builder }, calls }
}

const has = (call: Call, f: string, col: string, value?: unknown) =>
  call.filters.some((x) => x[0] === f && x[1] === col && (value === undefined || x[2] === value))

// ---------------------------------------------------------------
// 픽스처
// ---------------------------------------------------------------

const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'u@example.com' }
const PLACE_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const R = ['a', 'b', 'c', 'd'].map((ch) => `${ch.repeat(8)}-${ch.repeat(4)}-4${ch.repeat(3)}-8${ch.repeat(3)}-${ch.repeat(12)}`)

const ALL_DAY: Hours = {
  mon: { open: '00:00', close: '24:00' },
  tue: { open: '00:00', close: '24:00' },
  wed: { open: '00:00', close: '24:00' },
  thu: { open: '00:00', close: '24:00' },
  fri: { open: '00:00', close: '24:00' },
  sat: { open: '00:00', close: '24:00' },
  sun: { open: '00:00', close: '24:00' },
}
const restaurants = R.map((id, i) => ({ id, name: `식당${i}`, address: `주소${i}`, hours: ALL_DAY }))

// 2026-09-04(금) 12:30 KST = 점심 슬롯 안
const NOW = new Date('2026-09-04T03:30:00Z')
const SLOT_DATE = '2026-09-04'

type Session = {
  id: string
  user_id: string
  place_id: string | null
  slot_date: string
  slot: 'lunch' | 'dinner'
  candidate_ids: string[]
  reroll_used: boolean
  chosen_restaurant_id: string | null
  status: 'open' | 'confirmed'
  confirmed_at: string | null
}

const openSession = (over: Partial<Session> = {}): Session => ({
  id: SESSION_ID,
  user_id: USER.id,
  place_id: PLACE_ID,
  slot_date: SLOT_DATE,
  slot: 'lunch',
  candidate_ids: [R[0], R[1], R[2]],
  reroll_used: false,
  chosen_restaurant_id: null,
  status: 'open',
  confirmed_at: null,
  ...over,
})

/**
 * 기본 DB 응답. 세션 조회/갱신은 시나리오별 over 로 덮는다.
 * - places: 소유 장소 1개
 * - place_restaurants: 후보 풀 3곳(모두 영업 중)
 * - restaurants / xp: 후보 카드 조립용
 */
function defaultHandler(over: Partial<Record<string, Handler>>): Handler {
  return (call) => {
    const custom = over[call.table]
    if (custom) {
      const r = custom(call)
      if (r !== undefined) return r
    }
    switch (call.table) {
      case 'places':
        return { data: { id: PLACE_ID, user_id: USER.id, name: '회사' } }
      case 'place_restaurants':
        return { data: restaurants.slice(0, 3).map((r) => ({ restaurants: r })) }
      case 'restaurants': {
        const ids = (call.filters.find((f) => f[0] === 'in')?.[2] as string[]) ?? []
        return { data: restaurants.filter((r) => ids.includes(r.id)) }
      }
      case 'roulette_sessions':
        if (has(call, 'eq', 'status', 'confirmed')) return { data: [] } // xp 조회
        return { data: null }
      default:
        return { data: null }
    }
  }
}

function setup(over: Partial<Record<string, Handler>> = {}) {
  const { admin, calls } = makeAdmin(defaultHandler(over))
  createAdminClientMock.mockReturnValue(admin)
  return { calls }
}

const sessionCalls = (calls: Call[]) => calls.filter((c) => c.table === 'roulette_sessions')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.stubEnv('ROULETTE_ALLOW_ANY_TIME', '')
  requireUserMock.mockResolvedValue(USER)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  createAdminClientMock.mockReset()
})

// ---------------------------------------------------------------
// 공통
// ---------------------------------------------------------------

describe('인증', () => {
  it('비로그인이면 AUTH_REQUIRED 이고 DB를 만지지 않는다', async () => {
    requireUserMock.mockResolvedValue(null)
    const { calls } = setup()
    expect(await spin(PLACE_ID)).toEqual({ ok: false, code: 'AUTH_REQUIRED', params: undefined })
    expect(await reroll(SESSION_ID)).toMatchObject({ ok: false, code: 'AUTH_REQUIRED' })
    expect(await confirm(SESSION_ID, R[0])).toMatchObject({ ok: false, code: 'AUTH_REQUIRED' })
    expect(calls).toHaveLength(0)
  })
})

describe('입력 검증 (A4)', () => {
  it('uuid가 아닌 placeId는 DB 호출 없이 PLACE_FORBIDDEN', async () => {
    const { calls } = setup()
    expect(await spin('not-a-uuid')).toMatchObject({ ok: false, code: 'PLACE_FORBIDDEN' })
    expect(await getHomeState('not-a-uuid')).toMatchObject({ ok: false, code: 'PLACE_FORBIDDEN' })
    // 직접 POST로 문자열이 아닌 값이 와도 같다.
    expect(await spin(123 as unknown as string)).toMatchObject({ ok: false, code: 'PLACE_FORBIDDEN' })
    expect(calls).toHaveLength(0)
  })

  it('uuid가 아닌 sessionId는 SESSION_NOT_OPEN, restaurantId는 NOT_A_CANDIDATE', async () => {
    const { calls } = setup()
    expect(await reroll('x')).toMatchObject({ ok: false, code: 'SESSION_NOT_OPEN' })
    expect(await confirm('x', R[0])).toMatchObject({ ok: false, code: 'SESSION_NOT_OPEN' })
    expect(await confirm(SESSION_ID, 'x')).toMatchObject({ ok: false, code: 'NOT_A_CANDIDATE' })
    expect(calls).toHaveLength(0)
  })
})

// ---------------------------------------------------------------
// spin
// ---------------------------------------------------------------

describe('spin', () => {
  it('insert가 23505(유일 제약)로 실패하면 기존 세션을 다시 읽어 돌려준다', async () => {
    const existing = openSession()
    let insertAttempted = false
    const { calls } = setup({
      roulette_sessions: (call) => {
        if (call.op === 'insert') {
          insertAttempted = true
          return { data: null, error: { code: '23505', message: 'duplicate key' } }
        }
        if (has(call, 'eq', 'slot_date')) return { data: insertAttempted ? existing : null }
        return undefined as unknown as DbResult
      },
    })

    const r = await spin(PLACE_ID)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.kind).toBe('open')
    if (r.data.kind !== 'open') return
    expect(r.data.sessionId).toBe(SESSION_ID)
    expect(r.data.candidates.map((c) => c.id)).toEqual(existing.candidate_ids)

    const inserts = sessionCalls(calls).filter((c) => c.op === 'insert')
    expect(inserts).toHaveLength(1)
    expect(inserts[0].payload).toMatchObject({ user_id: USER.id, place_id: PLACE_ID, status: 'open' })
    // 삽입 전 1회 + 23505 후 1회 = 슬롯 조회 2회
    expect(sessionCalls(calls).filter((c) => has(c, 'eq', 'slot_date'))).toHaveLength(2)
  })

  it('23505가 아닌 insert 오류는 UNEXPECTED', async () => {
    setup({
      roulette_sessions: (call) =>
        call.op === 'insert' ? { data: null, error: { code: '42P01', message: 'boom' } } : (undefined as unknown as DbResult),
    })
    expect(await spin(PLACE_ID)).toMatchObject({ ok: false, code: 'UNEXPECTED' })
  })

  it('남의 장소면 PLACE_FORBIDDEN', async () => {
    setup({ places: () => ({ data: null }) })
    expect(await spin(PLACE_ID)).toMatchObject({ ok: false, code: 'PLACE_FORBIDDEN' })
  })
})

// ---------------------------------------------------------------
// reroll
// ---------------------------------------------------------------

describe('reroll', () => {
  function rerollSetup(afterUpdate: Session | null) {
    let updated = false
    return setup({
      roulette_sessions: (call) => {
        if (call.op === 'update') {
          updated = true
          return { data: [] } // 조건부 update 0건
        }
        if (has(call, 'eq', 'id', SESSION_ID)) return { data: updated ? afterUpdate : openSession() }
        return undefined as unknown as DbResult
      },
    })
  }

  it('조건부 update가 0건이고 그 사이 확정되었으면 SESSION_NOT_OPEN', async () => {
    const { calls } = rerollSetup(openSession({ status: 'confirmed', chosen_restaurant_id: R[0] }))
    expect(await reroll(SESSION_ID)).toMatchObject({ ok: false, code: 'SESSION_NOT_OPEN' })
    const update = sessionCalls(calls).find((c) => c.op === 'update')!
    expect(update.payload).toMatchObject({ reroll_used: true })
    expect(has(update, 'eq', 'status', 'open')).toBe(true)
    expect(has(update, 'eq', 'reroll_used', false)).toBe(true)
  })

  it('조건부 update가 0건이고 아직 open이면(다른 요청이 먼저 돌림) REROLL_ALREADY_USED', async () => {
    rerollSetup(openSession({ reroll_used: true, candidate_ids: [R[1], R[2], R[3]] }))
    expect(await reroll(SESSION_ID)).toMatchObject({ ok: false, code: 'REROLL_ALREADY_USED' })
  })

  it('이미 reroll_used 면 update 없이 REROLL_ALREADY_USED', async () => {
    const { calls } = setup({
      roulette_sessions: (call) =>
        has(call, 'eq', 'id', SESSION_ID) ? { data: openSession({ reroll_used: true }) } : (undefined as unknown as DbResult),
    })
    expect(await reroll(SESSION_ID)).toMatchObject({ ok: false, code: 'REROLL_ALREADY_USED' })
    expect(sessionCalls(calls).some((c) => c.op === 'update')).toBe(false)
  })
})

// ---------------------------------------------------------------
// confirm
// ---------------------------------------------------------------

describe('confirm', () => {
  it('candidate_ids 밖의 식당은 update 없이 NOT_A_CANDIDATE', async () => {
    const { calls } = setup({
      roulette_sessions: (call) =>
        has(call, 'eq', 'id', SESSION_ID) ? { data: openSession() } : (undefined as unknown as DbResult),
    })
    expect(await confirm(SESSION_ID, R[3])).toMatchObject({ ok: false, code: 'NOT_A_CANDIDATE' })
    expect(sessionCalls(calls).some((c) => c.op === 'update')).toBe(false)
  })

  function confirmRaceSetup(afterUpdate: Session) {
    let updated = false
    return setup({
      roulette_sessions: (call) => {
        if (call.op === 'update') {
          updated = true
          return { data: [] }
        }
        if (has(call, 'eq', 'id', SESSION_ID)) return { data: updated ? afterUpdate : openSession() }
        return undefined as unknown as DbResult
      },
    })
  }

  it('update가 0건이고 세션이 아직 open이면(다시 돌리기로 후보가 바뀜) NOT_A_CANDIDATE', async () => {
    const { calls } = confirmRaceSetup(openSession({ reroll_used: true, candidate_ids: [R[1], R[2], R[3]] }))
    expect(await confirm(SESSION_ID, R[0])).toMatchObject({ ok: false, code: 'NOT_A_CANDIDATE' })
    const update = sessionCalls(calls).find((c) => c.op === 'update')!
    expect(update.payload).toMatchObject({ chosen_restaurant_id: R[0], status: 'confirmed' })
    expect(has(update, 'eq', 'status', 'open')).toBe(true)
    expect(update.filters).toContainEqual(['contains', 'candidate_ids', [R[0]]])
  })

  it('update가 0건이고 그 사이 확정되었으면 SESSION_NOT_OPEN', async () => {
    confirmRaceSetup(openSession({ status: 'confirmed', chosen_restaurant_id: R[1] }))
    expect(await confirm(SESSION_ID, R[0])).toMatchObject({ ok: false, code: 'SESSION_NOT_OPEN' })
  })

  it('정상 확정이면 confirmed 상태를 돌려준다', async () => {
    setup({
      roulette_sessions: (call) => {
        if (call.op === 'update') {
          return { data: [openSession({ status: 'confirmed', chosen_restaurant_id: R[0], confirmed_at: NOW.toISOString() })] }
        }
        if (has(call, 'eq', 'id', SESSION_ID)) return { data: openSession() }
        if (has(call, 'eq', 'status', 'confirmed')) return { data: [{ chosen_restaurant_id: R[0] }] }
        return undefined as unknown as DbResult
      },
    })
    const r = await confirm(SESSION_ID, R[0])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.kind).toBe('confirmed')
    if (r.data.kind !== 'confirmed') return
    expect(r.data.chosen.id).toBe(R[0])
    expect(r.data.chosen.xp).toBe(1)
    expect(r.data.leveledUp).toBe(true)
  })
})
