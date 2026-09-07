# 세션 K1: 서버 (순수 함수 toRecordRows, toMarkers와 서버 액션 loadRecordsScreen)

[← 인덱스](README.md). Global Constraints와 병렬 단계 규칙은 인덱스를 따른다. 선행: K0 커밋.

**소유 파일:** `src/actions/records-helpers.ts`, `src/actions/records.ts`, `tests/actions/records-helpers.test.ts`, `tests/actions/records.test.ts`. 그 밖의 파일은 읽기만 한다. `src/app/(app)/records/` 아래는 쓰지 않는다.

**중요:** 기존 `listRecords`는 이 세션에서 지우지 않는다. 기록 페이지가 아직 그것을 쓰고 있어서 지우면 빌드가 깨진다. K3가 페이지를 바꾸면서 지운다.

---

### Task K1-1: 순수 함수 toRecordRows, toMarkers (TDD)

**Files:**
- Create: `src/actions/records-helpers.ts`
- Test: `tests/actions/records-helpers.test.ts`

**Interfaces:**
- Consumes: `RecordRow`, `MapMarker` (`src/actions/records-types.ts`, K0). `levelAtTime`, `levelName` (`src/actions/roulette-helpers.ts`). `getLevel` (`src/rules/level.ts`). `SLOTS` (`src/config/slots.ts`).
- Produces:
  - `type JoinedRestaurant = { id: string; name: string; address: string; lat: number | null; lng: number | null }`
  - `type JoinedRow = { slot_date: string; slot: Slot; chosen_restaurant_id: string | null; confirmed_at: string | null; places: { name: string } | { name: string }[] | null; restaurants: JoinedRestaurant | JoinedRestaurant[] | null }`
  - `toRecordRows(rows: JoinedRow[]): RecordRow[]` — 입력 순서 유지. `chosen_restaurant_id` 또는 `confirmed_at`이 null인 행 제외. 장소 null이면 `'삭제된 장소'`.
  - `toMarkers(rows: JoinedRow[]): MapMarker[]` — 식당별 하나. 방문 횟수 내림차순, 같으면 이름 오름차순. 좌표가 유한한 숫자가 아니면 제외.
  - Task K1-2가 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성** `tests/actions/records-helpers.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { toMarkers, toRecordRows, type JoinedRow } from '@/actions/records-helpers'

const KIMBAP = { id: 'r-kimbap', name: '김밥천국', address: '강남대로 123', lat: 37.5, lng: 127.03 }
const BONJUK = { id: 'r-bonjuk', name: '본죽', address: '테헤란로 45', lat: 37.51, lng: 127.04 }

function row(over: Partial<JoinedRow> & { slot_date: string }): JoinedRow {
  return {
    slot: 'lunch',
    chosen_restaurant_id: KIMBAP.id,
    confirmed_at: `${over.slot_date}T03:30:00Z`,
    places: { name: '회사' },
    restaurants: KIMBAP,
    ...over,
  }
}

// 서버가 주는 순서(slot_date desc)대로
const ROWS: JoinedRow[] = [
  row({ slot_date: '2026-09-04' }),
  row({ slot_date: '2026-09-03', slot: 'dinner', places: { name: '집' } }),
  row({ slot_date: '2026-09-02', chosen_restaurant_id: BONJUK.id, restaurants: BONJUK }),
  row({ slot_date: '2026-09-01' }),
]

describe('toRecordRows', () => {
  it('입력 순서를 지키고 슬롯 라벨, 장소 이름, 식당 id를 채운다', () => {
    const out = toRecordRows(ROWS)
    expect(out.map((r) => r.slotDate)).toEqual(['2026-09-04', '2026-09-03', '2026-09-02', '2026-09-01'])
    expect(out[1]).toMatchObject({ slot: 'dinner', slotLabel: '저녁', placeName: '집', restaurantId: KIMBAP.id, restaurantName: '김밥천국' })
  })

  it('확정 당시 레벨: 그 시각까지의 같은 식당 확정 횟수로 계산한다', () => {
    const out = toRecordRows(ROWS)
    // 레벨 표(스펙 05): 경험치 1 → Lv2 익숙, 3 → Lv3 단골. 첫 확정이 곧 경험치 1이다.
    // 김밥천국: 9/1 1회(Lv2 익숙), 9/3 2회(Lv2 익숙), 9/4 3회(Lv3 단골)
    expect(out.find((r) => r.slotDate === '2026-09-01')).toMatchObject({ levelAtThatTime: 2, levelName: '익숙' })
    expect(out.find((r) => r.slotDate === '2026-09-03')).toMatchObject({ levelAtThatTime: 2, levelName: '익숙' })
    expect(out.find((r) => r.slotDate === '2026-09-04')).toMatchObject({ levelAtThatTime: 3, levelName: '단골' })
  })

  it('장소가 삭제됐으면 "삭제된 장소", 확정 정보가 없는 행은 뺀다', () => {
    const out = toRecordRows([
      row({ slot_date: '2026-09-04', places: null }),
      row({ slot_date: '2026-09-03', chosen_restaurant_id: null }),
      row({ slot_date: '2026-09-02', confirmed_at: null }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].placeName).toBe('삭제된 장소')
  })

  it('조인 결과가 배열이어도 첫 항목을 쓴다', () => {
    const out = toRecordRows([row({ slot_date: '2026-09-04', places: [{ name: '회사' }], restaurants: [KIMBAP] })])
    expect(out[0]).toMatchObject({ placeName: '회사', restaurantName: '김밥천국' })
  })
})

describe('toMarkers', () => {
  it('식당 하나에 마커 하나. 방문 횟수, 레벨, 마지막 방문일을 채운다', () => {
    const out = toMarkers(ROWS)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      restaurantId: KIMBAP.id,
      name: '김밥천국',
      address: '강남대로 123',
      lat: 37.5,
      lng: 127.03,
      visits: 3,
      level: 3,
      levelName: '단골',
      lastVisitDate: '2026-09-04',
    })
    // 방문 1회 = 경험치 1 → Lv2 익숙 (스펙 05 레벨 표)
    expect(out[1]).toMatchObject({ restaurantId: BONJUK.id, visits: 1, level: 2, levelName: '익숙', lastVisitDate: '2026-09-02' })
  })

  it('마지막 방문일은 입력 순서와 무관하게 가장 늦은 날짜다', () => {
    const out = toMarkers([row({ slot_date: '2026-09-01' }), row({ slot_date: '2026-09-04' }), row({ slot_date: '2026-09-02' })])
    expect(out[0].lastVisitDate).toBe('2026-09-04')
  })

  it('방문 횟수 내림차순, 같으면 이름 오름차순', () => {
    const out = toMarkers([
      row({ slot_date: '2026-09-04', chosen_restaurant_id: BONJUK.id, restaurants: BONJUK }),
      row({ slot_date: '2026-09-03' }),
    ])
    expect(out.map((m) => m.name)).toEqual(['김밥천국', '본죽'])
  })

  it('좌표가 없거나 유한하지 않은 식당은 뺀다', () => {
    const noLat = { ...BONJUK, lat: null }
    const nan = { ...BONJUK, id: 'r-nan', lng: Number.NaN }
    const out = toMarkers([
      row({ slot_date: '2026-09-04' }),
      row({ slot_date: '2026-09-03', chosen_restaurant_id: noLat.id, restaurants: noLat }),
      row({ slot_date: '2026-09-02', chosen_restaurant_id: nan.id, restaurants: nan }),
    ])
    expect(out.map((m) => m.restaurantId)).toEqual([KIMBAP.id])
  })

  it('식당 조인이 null이거나 확정 정보가 없는 행은 뺀다. 빈 입력은 빈 배열', () => {
    expect(toMarkers([])).toEqual([])
    expect(toMarkers([row({ slot_date: '2026-09-04', restaurants: null }), row({ slot_date: '2026-09-03', chosen_restaurant_id: null })])).toEqual([])
  })

  it('레벨은 방문 횟수를 레벨 표에 대입한 값이다 (7회 → 4 찐단골)', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map((d) => row({ slot_date: `2026-09-0${d}` }))
    expect(toMarkers(rows)[0]).toMatchObject({ visits: 7, level: 4, levelName: '찐단골' })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/actions/records-helpers.test.ts`
Expected: FAIL. `Failed to resolve import "@/actions/records-helpers"`.

- [ ] **Step 3: 구현** `src/actions/records-helpers.ts`

```ts
import { SLOTS } from '@/config/slots'
import { getLevel } from '@/rules/level'
import type { Slot } from '@/rules/types'
import { levelAtTime, levelName } from '@/actions/roulette-helpers'
import type { MapMarker, RecordRow } from '@/actions/records-types'

/** 기록 액션에서 쓰는 순수 헬퍼. 'use server'가 아니므로 단위 테스트가 가능하다. 스펙 16 데이터. */

export type JoinedRestaurant = {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
}

/** roulette_sessions에 places(name), restaurants(id, name, address, lat, lng)를 조인한 행. */
export type JoinedRow = {
  slot_date: string
  slot: Slot
  chosen_restaurant_id: string | null
  confirmed_at: string | null
  places: { name: string } | { name: string }[] | null
  restaurants: JoinedRestaurant | JoinedRestaurant[] | null
}

const DELETED_PLACE = '삭제된 장소'

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/**
 * F8. 날짜별 기록. 입력 순서(slot_date desc, slot desc)를 지킨다.
 * 확정 당시 레벨은 같은 식당의 confirmed_at ≤ 이 행 시각인 행 수로 계산한다(levelAtTime).
 */
export function toRecordRows(rows: JoinedRow[]): RecordRow[] {
  const out: RecordRow[] = []
  for (const r of rows) {
    if (!r.chosen_restaurant_id || !r.confirmed_at) continue
    const level = levelAtTime(rows, r.chosen_restaurant_id, r.confirmed_at)
    out.push({
      slotDate: r.slot_date,
      slot: r.slot,
      slotLabel: SLOTS[r.slot].label,
      placeName: one(r.places)?.name ?? DELETED_PLACE,
      restaurantId: r.chosen_restaurant_id,
      restaurantName: one(r.restaurants)?.name ?? '',
      levelAtThatTime: level,
      levelName: levelName(level),
    })
  }
  return out
}

/**
 * 식당 하나 = 마커 하나 (스펙 16 M1). visits는 confirmed 행 수, level은 getLevel(visits).
 * 좌표가 유한한 숫자가 아닌 식당은 뺀다. 정렬: visits desc, name asc.
 */
export function toMarkers(rows: JoinedRow[]): MapMarker[] {
  const byId = new Map<string, MapMarker>()
  for (const r of rows) {
    if (!r.chosen_restaurant_id || !r.confirmed_at) continue
    const rest = one(r.restaurants)
    if (!rest) continue
    const found = byId.get(rest.id)
    if (found) {
      found.visits += 1
      if (r.slot_date > found.lastVisitDate) found.lastVisitDate = r.slot_date
      continue
    }
    if (typeof rest.lat !== 'number' || typeof rest.lng !== 'number') continue
    if (!Number.isFinite(rest.lat) || !Number.isFinite(rest.lng)) continue
    byId.set(rest.id, {
      restaurantId: rest.id,
      name: rest.name,
      address: rest.address,
      lat: rest.lat,
      lng: rest.lng,
      visits: 1,
      level: 1,
      levelName: '',
      lastVisitDate: r.slot_date,
    })
  }
  const out = [...byId.values()].map((m) => {
    const lv = getLevel(m.visits)
    return { ...m, level: lv.level, levelName: lv.name }
  })
  out.sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, 'ko'))
  return out
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/actions/records-helpers.test.ts`
Expected: PASS 10건.

- [ ] **Step 5: 커밋**

```bash
git add src/actions/records-helpers.ts tests/actions/records-helpers.test.ts
git commit -m "feat(map): 기록 행을 날짜별 목록과 식당별 마커로 가공하는 순수 함수 (스펙 16)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D9kAoPJFsiCpzGBkUqNKkH"
```

---

### Task K1-2: 서버 액션 loadRecordsScreen (모의 클라이언트 테스트)

**Files:**
- Modify: `src/actions/records.ts` (함수 추가. `listRecords`는 그대로 둔다)
- Test: `tests/actions/records.test.ts`

**Interfaces:**
- Consumes: `toRecordRows`, `toMarkers`, `JoinedRow` (Task K1-1). `RecordsScreenData`, `SEOUL_CITY_HALL` (K0). `requireUser` (`src/lib/auth.ts`), `createAdminClient` (`src/lib/supabase/admin.ts`), `fail`, `ok`, `Result` (`src/lib/result.ts`).
- Produces: `loadRecordsScreen(): Promise<Result<RecordsScreenData>>`. K3의 기록 페이지가 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성** `tests/actions/records.test.ts`

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/actions/records.test.ts`
Expected: FAIL. `loadRecordsScreen` export 없음(`is not a function`).

- [ ] **Step 3: 구현** `src/actions/records.ts`

파일 맨 위 import 블록을 아래로 바꾼다(기존 import에 세 줄이 는다). 기존 `listRecords`, `RecordRow`, `Joined`, `one`, `DELETED_PLACE`는 **그대로 둔다**.

```ts
'use server'

import { SLOTS } from '@/config/slots'
import { requireUser } from '@/lib/auth'
import { fail, ok, type Result } from '@/lib/result'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Slot } from '@/rules/types'
import { levelAtTime, levelName } from '@/actions/roulette-helpers'
import { toMarkers, toRecordRows, type JoinedRow } from '@/actions/records-helpers'
import { SEOUL_CITY_HALL, type LatLng, type RecordsScreenData } from '@/actions/records-types'
```

파일 끝에 추가:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/actions/records.test.ts`
Expected: PASS 7건.

- [ ] **Step 5: 타입 검사, 린트, 전체 테스트**

Run: `npx tsc --noEmit; npm run lint; npm test`
Expected: 자기 파일에서 오류 0, 테스트 전부 PASS. (K2가 동시에 작업 중이라 `src/app/(app)/records/` 쪽 타입 오류가 잠깐 보일 수 있다. 보고서에 적고 넘어간다.)

- [ ] **Step 6: 커밋**

```bash
git add src/actions/records.ts tests/actions/records.test.ts
git commit -m "feat(map): 기록 화면 데이터 액션 loadRecordsScreen (조회 한 번, 목록 + 마커 + 기본 중심) (스펙 16)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D9kAoPJFsiCpzGBkUqNKkH"
```

- [ ] **Step 7: 보고**

바꾼 파일, 커밋 해시 2개, 테스트 결과(명령 출력 그대로), 부족한 것, 남의 파일에서 본 오류, 스펙과 다르게 한 것과 이유를 적어 보고한다.
