import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 의존성 목킹: 인증, admin 클라이언트. 액션 시그니처는 그대로.
const requireUserMock = vi.fn()
vi.mock('@/lib/auth', () => ({ requireUser: () => requireUserMock() }))

const createAdminClientMock = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClientMock() }))

import { loadRecordsScreen } from '@/actions/records'

// supabase 쿼리 빌더 최소 목. select 문자열과 체이닝을 기록하고 await 시점에 handler로 결과를 만든다.
type Call = { table: string; select?: string; filters: unknown[][]; terminal?: 'maybeSingle' }
type DbResult = { data?: unknown; error?: unknown }
type Handler = (call: Call) => DbResult

function makeAdmin(handler: Handler) {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, filters: [] }
    calls.push(call)
    const chain: Record<string, unknown> = {}
    chain.select = (s: string) => ((call.select = s), chain)
    for (const f of ['eq', 'order', 'limit']) {
      chain[f] = (...args: unknown[]) => {
        call.filters.push([f, ...args])
        return chain
      }
    }
    chain.maybeSingle = () => ((call.terminal = 'maybeSingle'), chain)
    chain.then = (onFul: (v: DbResult) => unknown, onRej?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => ({ data: null, error: null, ...handler(call) }))
        .then(onFul, onRej)
    return chain
  }
  return { admin: { from }, calls }
}

const has = (call: Call, f: string, col: string, value?: unknown) =>
  call.filters.some((x) => x[0] === f && x[1] === col && (value === undefined || x[2] === value))

const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'u@example.com' }
const KIMBAP = { id: 'r-kimbap', name: '김밥천국', address: '강남대로 123', lat: 37.5, lng: 127.03 }
const BONJUK = { id: 'r-bonjuk', name: '본죽', address: '테헤란로 45', lat: 37.51, lng: 127.04 }

const SESSIONS = [
  { slot_date: '2026-09-04', slot: 'lunch', chosen_restaurant_id: KIMBAP.id, confirmed_at: '2026-09-04T03:30:00Z', places: { name: '회사' }, restaurants: KIMBAP },
  { slot_date: '2026-09-03', slot: 'lunch', chosen_restaurant_id: BONJUK.id, confirmed_at: '2026-09-03T03:30:00Z', places: { name: '회사' }, restaurants: BONJUK },
  { slot_date: '2026-09-02', slot: 'lunch', chosen_restaurant_id: KIMBAP.id, confirmed_at: '2026-09-02T03:30:00Z', places: { name: '회사' }, restaurants: KIMBAP },
]

function setup(over: Partial<Record<string, Handler>> = {}) {
  const { admin, calls } = makeAdmin((call) => {
    const custom = over[call.table]
    if (custom) return custom(call)
    if (call.table === 'roulette_sessions') return { data: SESSIONS }
    if (call.table === 'places') return { data: { lat: 37.49, lng: 127.02 } }
    return { data: null }
  })
  createAdminClientMock.mockReturnValue(admin)
  return { calls }
}

beforeEach(() => {
  requireUserMock.mockResolvedValue(USER)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  createAdminClientMock.mockReset()
})

describe('loadRecordsScreen', () => {
  it('비로그인이면 AUTH_REQUIRED 이고 DB를 만지지 않는다', async () => {
    requireUserMock.mockResolvedValue(null)
    const { calls } = setup()
    expect(await loadRecordsScreen()).toEqual({ ok: false, code: 'AUTH_REQUIRED', params: undefined })
    expect(calls).toHaveLength(0)
  })

  it('confirmed 세션 한 번 조회로 기록 3개와 마커 2개를 만들고 서로 restaurantId로 이어진다', async () => {
    const { calls } = setup()
    const r = await loadRecordsScreen()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.records).toHaveLength(3)
    expect(r.data.markers.map((m) => [m.restaurantId, m.visits])).toEqual([[KIMBAP.id, 2], [BONJUK.id, 1]])
    for (const rec of r.data.records) {
      expect(r.data.markers.some((m) => m.restaurantId === rec.restaurantId)).toBe(true)
    }
    const sessionCalls = calls.filter((c) => c.table === 'roulette_sessions')
    expect(sessionCalls).toHaveLength(1)
  })

  it('세션 조회는 본인, confirmed, 날짜와 슬롯 내림차순이고 select에 식당 id와 좌표가 있다', async () => {
    const { calls } = setup()
    await loadRecordsScreen()
    const call = calls.find((c) => c.table === 'roulette_sessions')!
    expect(has(call, 'eq', 'user_id', USER.id)).toBe(true)
    expect(has(call, 'eq', 'status', 'confirmed')).toBe(true)
    expect(call.filters).toContainEqual(['order', 'slot_date', { ascending: false }])
    expect(call.filters).toContainEqual(['order', 'slot', { ascending: false }])
    // 이 문자열이 빠지면 마커가 0개가 되는 회귀를 막는다.
    expect(call.select).toContain('restaurants(id, name, address, lat, lng)')
    expect(call.select).toContain('places(name)')
  })

  it('fallbackCenter는 첫 장소(created_at asc, 1건) 좌표다', async () => {
    const { calls } = setup()
    const r = await loadRecordsScreen()
    expect(r.ok && r.data.fallbackCenter).toEqual({ lat: 37.49, lng: 127.02 })
    const call = calls.find((c) => c.table === 'places')!
    expect(has(call, 'eq', 'user_id', USER.id)).toBe(true)
    expect(call.filters).toContainEqual(['order', 'created_at', { ascending: true }])
    expect(call.filters).toContainEqual(['limit', 1])
    expect(call.terminal).toBe('maybeSingle')
  })

  it('장소가 없으면 fallbackCenter는 서울시청', async () => {
    setup({ places: () => ({ data: null }) })
    const r = await loadRecordsScreen()
    expect(r.ok && r.data.fallbackCenter).toEqual({ lat: 37.5665, lng: 126.978 })
  })

  it('기록이 없으면 빈 목록과 빈 마커', async () => {
    setup({ roulette_sessions: () => ({ data: [] }) })
    const r = await loadRecordsScreen()
    expect(r.ok && r.data.records).toEqual([])
    expect(r.ok && r.data.markers).toEqual([])
  })

  it('조회 오류는 UNEXPECTED', async () => {
    setup({ roulette_sessions: () => ({ data: null, error: { message: 'boom' } }) })
    expect(await loadRecordsScreen()).toMatchObject({ ok: false, code: 'UNEXPECTED' })
    setup({ places: () => ({ data: null, error: { message: 'boom' } }) })
    expect(await loadRecordsScreen()).toMatchObject({ ok: false, code: 'UNEXPECTED' })
  })
})
