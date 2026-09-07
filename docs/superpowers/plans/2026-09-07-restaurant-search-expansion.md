# 식당 수집 확장(키워드 9개 + 2×2 격자) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장소 생성 시 카카오 로컬 API 질의를 키워드 9개와 2×2 격자로 나눠 여러 번 호출하고 id로 합쳐, 질의당 45개인 카카오 상한을 넘겨 장소당 거리순 최대 200개 식당을 저장한다.

**Architecture:** fetch가 없는 순수 함수 셋(`gridCells`, `capByDistance`, `mapWithConcurrency`)을 `src/places/collect.ts`에 새로 두고 Vitest로 촘촘히 검증한다. `src/places/kakao.ts`의 `searchRestaurants`는 셀 × 키워드 작업을 만들어 동시 5개로 돌린 뒤 Map으로 합치고 거리순 200개로 자른다. 시그니처, 서버 액션, RPC, 데이터 모델, 화면은 그대로이고 반경 상한만 2000→1000으로 줄인다. 0번 작업은 실제 REST 키로 재는 스파이크이며 그 결과가 셀 질의의 정렬 방식을 결정한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, 카카오 로컬 REST API(`/v2/local/search/keyword.json`), Vitest 5, tsx(스파이크 스크립트 실행). 새 npm 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-04-lunch-roulette/17-restaurant-search-expansion.md`. 결정 기록은 `02-decisions.md` D18, 외부 API는 `09-external-api.md`, 오류 규약은 `08-errors.md`, 테스트 계층은 `11-testing.md`, 스파이크 방식은 `12-pre-implementation-spike.md`.

## Global Constraints

- 결정 E1~E9(스펙 17)는 다시 논의하지 않는다.
- 키워드는 정확히 이 9개, 이 순서: `음식점, 한식, 중식, 일식, 양식, 분식, 아시아음식, 패스트푸드, 술집`. 전부 `category_group_code=FD6`. 카페(CE7)는 수집하지 않는다. (E2, E3)
- 상수 값: `GRID_THRESHOLD_M = 500`, `MAX_RESTAURANTS = 200`, `CONCURRENCY = 5`, `MAX_PAGES = 3`, 페이지 크기 15. (스펙 17 코드 구조)
- 반경 허용 범위 100~1000m. 서버는 clamp, 폼은 `max={1000}`. 이미 1000m 넘게 만든 장소는 그대로 둔다. (E5)
- 셀: R ≤ 500이면 `radius` 하나, 500 < R ≤ 1000이면 `rect` 넷. 위도 1도 = 111,320m, 경도 1도 = 111,320 × cos(위도) m. (스펙 17 수집 알고리즘 1)
- 작업 하나라도 실패하면 전체 `ExternalApiError`. 아직 시작하지 않은 작업은 시작하지 않는다. 새 오류 코드는 만들지 않는다. (E7, 스펙 08)
- 합칠 때 키는 `kakao:<id>`. 거리 오름차순, 같은 거리는 id 문자열순. (스펙 17 수집 알고리즘 3)
- 서버 로그는 한 줄이며 API 키와 쿼리 문자열을 넣지 않는다. (스펙 17 수집 알고리즘 5)
- `searchRestaurants(center, radiusM)`, `FoundRestaurant`, `createPlace`, RPC `create_place_with_restaurants`, `geocode`, Google 어댑터는 바꾸지 않는다.
- 새 npm 의존성을 추가하지 않는다.
- 스파이크 스크립트 `scripts/spike-kakao-search.ts`는 커밋하지 않는다. `git add`에 절대 넣지 않는다.
- 스펙 14(해피케이스)는 구현이 끝난 Task 6에서만 갱신한다. (작업 규칙)
- 커밋할 때 `git add`는 바꾼 파일을 명시한다. `git add -A`, `git add .` 금지. 커밋 메시지는 한국어이며 아래 트레일러를 붙인다.

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gc2BJELpBUT1NKLXAwiwsY
```

- 검증 명령: 타입 `npx tsc --noEmit`, 린트 `npm run lint`, 테스트 `npm test`(Vitest, `tests/**/*.test.ts`), 빌드 `npm run build`. 기존 테스트 전부 통과가 전제다.
- 작업 트리에 이미 미커밋 변경(`docs/superpowers/handoff/2026-09-04-session-handoff.md` 수정, `docs/figma/` 미추적, `supabase/.temp/`)이 있다. 이 계획의 파일이 아니면 건드리지 않고 커밋에도 넣지 않는다. 단 Task 6의 인수인계 갱신은 그 파일의 기존 수정 위에 이어서 쓴다.

---

## 파일 구조

| 파일 | 변경 | 책임 |
|---|---|---|
| `scripts/spike-kakao-search.ts` | 신설, **미커밋** | Task 0. 실제 키로 병용 여부와 개수를 잰다. Task 6에서 지운다 |
| `docs/superpowers/specs/2026-09-04-lunch-roulette/17-restaurant-search-expansion.md` | 수정 | Task 0에서 결과 표를 채우고, Task 6에서 구현 완료를 적는다 |
| `src/places/collect.ts` | 신설 | fetch 없는 순수 함수: `gridCells`, `capByDistance`, `mapWithConcurrency`. 상수 `GRID_THRESHOLD_M` |
| `tests/places/collect.test.ts` | 신설 | 위 셋의 단위 테스트 |
| `src/places/kakao.ts` | 수정 | 상수 `KEYWORDS`, `MAX_RESTAURANTS`, `CONCURRENCY`, `MAX_PAGES`. `searchRestaurants`를 작업 기반으로 다시 쓴다. `geocode`와 문서 파싱은 그대로 |
| `tests/places/kakao.test.ts` | 개편 | 모의 fetch를 URL 파라미터로 분기. 작업별 단언 |
| `src/actions/places.ts` | 수정 | `RADIUS_MAX` 2000 → 1000 |
| `src/app/(app)/places/PlaceForm.tsx` | 수정 | 반경 입력 `max={1000}` |
| `src/app/(app)/places/page.tsx` | 수정 | `export const maxDuration = 30`. 서버 액션이 최악 6초 + 지오코딩 + DB라 Vercel 기본 10초에 가까워서 넉넉히 둔다. 스펙에 없는 추가이며 Task 6에서 스펙 17 코드 구조 표에 적는다 |
| `docs/superpowers/specs/2026-09-04-lunch-roulette/14-userflow-happy-case.md` | 수정(Task 6만) | F2 행 "최대 60곳" → "거리순 최대 200곳" |
| `docs/superpowers/specs/2026-09-04-lunch-roulette/13-backlog.md` | 수정(Task 6만) | B10 처리 메모에 구현 완료 날짜 |
| `docs/superpowers/handoff/2026-09-04-session-handoff.md` | 수정(Task 6만) | 스펙 17 구현·배포 상태 추가 |

스펙과 다른 점 하나: `GRID_THRESHOLD_M`은 스펙이 `kakao.ts`에 두라고 했지만 그 값을 쓰는 `gridCells`가 `collect.ts`에 있으므로 `collect.ts`에서 정의하고 export한다. `kakao.ts`는 import해서 쓰지 않아도 된다(`gridCells`가 알아서 판단한다).

## 작업 순서와 의존

| 작업 | 내용 | 선행 | 예상 시간 |
|---|---|---|---|
| Task 0 | 스파이크(병용 확인, 개수, 할당량) → 스펙 17 결과 표 | 실제 `KAKAO_REST_API_KEY`가 `.env.local`에 있음 | 30분 |
| Task 1 | `gridCells` TDD | 없음 | 15분 |
| Task 2 | `capByDistance` TDD | 없음 | 10분 |
| Task 3 | `mapWithConcurrency` TDD | 없음 | 15분 |
| Task 4 | `kakao.ts` `searchRestaurants` 개편 + `kakao.test.ts` 개편 | Task 0(정렬 방식), 1, 2, 3 | 40분 |
| Task 5 | 반경 상한 1000, `maxDuration` | 없음 | 10분 |
| Task 6 | 통합 검증, 실제 키로 장소 생성, 문서 갱신, 스크립트 삭제, 배포 확인 | Task 0~5 | 30분 |

Task 1~3은 서로 독립이고 같은 파일(`collect.ts`, `collect.test.ts`)에 이어 붙이는 구조라 한 세션이 순서대로 하는 것이 가장 단순하다. Task 0과 Task 5는 다른 것과 겹치지 않는다.

---

### Task 0: 스파이크 (병용 확인, 500/1000m 개수, 일 할당량)

**Files:**
- Create: `scripts/spike-kakao-search.ts` (**커밋하지 않는다**)
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/17-restaurant-search-expansion.md` "결과 (스파이크 뒤 채움)" 절

**Interfaces:**
- Consumes: `distanceMeters` (`src/places/distance.ts`), `.env.local`의 `KAKAO_REST_API_KEY`.
- Produces: 스펙 17 결과 표와 두 줄(병용 여부, 일 할당량), 그리고 Task 4가 고를 **변형 A/B** 결정. 변형 A = `rect` + `x/y` + `sort=distance`가 되고 문서가 rect 안에 머문다. 변형 B = 안 되므로 셀 질의는 `rect` + `sort=accuracy`만 보낸다.

- [x] **Step 1: 스크립트 작성** `scripts/spike-kakao-search.ts`

```ts
/**
 * 스펙 17 스파이크. 커밋하지 않는다. (구현 계획 Task 0)
 *
 *   npx tsx scripts/spike-kakao-search.ts rect
 *   npx tsx scripts/spike-kakao-search.ts count "강남역" 500
 *   npx tsx scripts/spike-kakao-search.ts count "강남역" 1000
 *   npx tsx scripts/spike-kakao-search.ts count "<실제 장소 주소>" 500
 *   npx tsx scripts/spike-kakao-search.ts count "<실제 장소 주소>" 1000
 *
 * .env.local 의 KAKAO_REST_API_KEY 를 읽는다. 키 값은 출력하지 않는다.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { distanceMeters } from '../src/places/distance'

const ROOT = resolve(__dirname, '..')

function loadEnvLocal(): void {
  const path = resolve(ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvLocal()
const KEY = process.env.KAKAO_REST_API_KEY
if (!KEY) {
  console.error('KAKAO_REST_API_KEY 가 없습니다 (.env.local)')
  process.exit(1)
}

const KEYWORDS = ['음식점', '한식', '중식', '일식', '양식', '분식', '아시아음식', '패스트푸드', '술집']
const CONCURRENCY = 5
const MAX_PAGES = 3
const MAX_RESTAURANTS = 200
const GRID_THRESHOLD_M = 500
const M_PER_DEG_LAT = 111_320
const KEYWORD_PATH = '/v2/local/search/keyword.json'

type LatLng = { lat: number; lng: number }
type Doc = Record<string, unknown>
type Cell = { kind: 'radius' } | { kind: 'rect'; rect: string }

async function get(path: string, params: Record<string, string | number>) {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  const res = await fetch(`https://dapi.kakao.com${path}?${qs}`, {
    headers: { Authorization: `KakaoAK ${KEY}` },
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  const documents = Array.isArray(json.documents) ? (json.documents as Doc[]) : []
  const meta = (json.meta ?? {}) as Record<string, unknown>
  return { status: res.status, json, documents, isEnd: meta.is_end !== false, meta }
}

async function geocode(q: string): Promise<LatLng> {
  for (const path of ['/v2/local/search/address.json', KEYWORD_PATH]) {
    const { documents } = await get(path, { query: q, size: 1 })
    const d = documents[0]
    if (d && Number.isFinite(Number(d.x)) && Number.isFinite(Number(d.y))) {
      return { lat: Number(d.y), lng: Number(d.x) }
    }
  }
  throw new Error(`좌표를 찾지 못했습니다: ${q}`)
}

function toPoint(d: Doc): LatLng | null {
  const lat = Number(d.y)
  const lng = Number(d.x)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

/** 스펙 17 수집 알고리즘 1. Task 1의 gridCells 와 같은 계산. */
function gridCells(center: LatLng, radiusM: number): Cell[] {
  if (radiusM <= GRID_THRESHOLD_M) return [{ kind: 'radius' }]
  const dLat = radiusM / M_PER_DEG_LAT
  const dLng = radiusM / (M_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180))
  const W = center.lng - dLng
  const E = center.lng + dLng
  const S = center.lat - dLat
  const N = center.lat + dLat
  const cx = center.lng
  const cy = center.lat
  return [
    { kind: 'rect', rect: `${W},${S},${cx},${cy}` },
    { kind: 'rect', rect: `${cx},${S},${E},${cy}` },
    { kind: 'rect', rect: `${W},${cy},${cx},${N}` },
    { kind: 'rect', rect: `${cx},${cy},${E},${N}` },
  ]
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  let failed = false
  async function worker(): Promise<void> {
    while (!failed) {
      const i = next++
      if (i >= items.length) return
      try {
        results[i] = await fn(items[i])
      } catch (e) {
        failed = true
        throw e
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** 항목 1: rect + x/y + sort=distance 병용. 강남역 북서쪽 셀 하나로 세 변형을 비교한다. */
async function rectSpike(): Promise<void> {
  const center = await geocode('강남역')
  const cells = gridCells(center, 600)
  const rect = (cells[0] as { rect: string }).rect
  const [x1, y1, x2, y2] = rect.split(',').map(Number)
  const base = { query: '음식점', category_group_code: 'FD6', size: 15, page: 1 }
  const variants: [string, Record<string, string | number>][] = [
    ['A rect + x/y + sort=distance', { ...base, rect, x: center.lng, y: center.lat, sort: 'distance' }],
    ['B rect + sort=accuracy       ', { ...base, rect, sort: 'accuracy' }],
    ['C rect + x/y (sort 없음)     ', { ...base, rect, x: center.lng, y: center.lat }],
  ]
  console.log(`강남역 중심 ${center.lat},${center.lng}  rect=${rect}`)
  for (const [label, params] of variants) {
    const { status, json, documents, meta } = await get(KEYWORD_PATH, params)
    const inside = documents.filter((d) => {
      const p = toPoint(d)
      return p && p.lng >= x1 && p.lng <= x2 && p.lat >= y1 && p.lat <= y2
    }).length
    const dists = documents.map((d) => Number(d.distance))
    const hasDistance = documents.length > 0 && dists.every((v) => Number.isFinite(v))
    const ascending = dists.every((v, i) => i === 0 || dists[i - 1] <= v)
    console.log(
      `${label} HTTP ${status} docs=${documents.length} rect안=${inside} total=${meta.total_count} pageable=${meta.pageable_count} distance필드=${hasDistance} 오름차순=${ascending} 앞5=${dists.slice(0, 5).join(',')}`,
    )
    if (status !== 200) console.log('  본문:', JSON.stringify(json).slice(0, 200))
  }
  console.log('판정: A가 HTTP 200이고 rect안=docs이고 distance필드=true이고 오름차순=true 이면 병용 가능(변형 A). 아니면 변형 B.')
}

/** 현재 방식: query=음식점 하나, radius, 최대 3페이지. */
async function currentMethod(center: LatLng, radiusM: number) {
  const seen = new Set<string>()
  let calls = 0
  for (let page = 1; page <= MAX_PAGES; page++) {
    calls++
    const { status, documents, isEnd, meta } = await get(KEYWORD_PATH, {
      query: '음식점', category_group_code: 'FD6', x: center.lng, y: center.lat, radius: radiusM, size: 15, page, sort: 'distance',
    })
    if (status !== 200) throw new Error(`현재 방식 HTTP ${status}`)
    if (page === 1) console.log(`  현재 방식 meta: total=${meta.total_count} pageable=${meta.pageable_count}`)
    for (const d of documents) {
      const p = toPoint(d)
      if (typeof d.id === 'string' && p && distanceMeters(center, p) <= radiusM) seen.add(d.id)
    }
    if (isEnd) break
  }
  return { count: seen.size, calls }
}

/** 새 방식: 셀 × 키워드 9개, 동시 5, 작업당 최대 3페이지, id 합치기, 거리순 200. */
async function newMethod(center: LatLng, radiusM: number) {
  const cells = gridCells(center, radiusM)
  const jobs = cells.flatMap((cell, i) => KEYWORDS.map((keyword) => ({ cell, i, keyword })))
  let calls = 0
  let raw = 0
  let got429 = false
  const seen = new Map<string, LatLng>()
  const started = Date.now()
  await mapWithConcurrency(jobs, CONCURRENCY, async (job) => {
    for (let page = 1; page <= MAX_PAGES; page++) {
      calls++
      const cellParams =
        job.cell.kind === 'radius'
          ? { x: center.lng, y: center.lat, radius: radiusM, sort: 'distance' }
          : { rect: job.cell.rect, x: center.lng, y: center.lat, sort: 'distance' } // 변형 B면 { rect, sort: 'accuracy' }
      const { status, documents, isEnd } = await get(KEYWORD_PATH, {
        query: job.keyword, category_group_code: 'FD6', size: 15, page, ...cellParams,
      })
      if (status === 429) got429 = true
      if (status !== 200) throw new Error(`새 방식 HTTP ${status} cell=${job.i} keyword=${job.keyword}`)
      for (const d of documents) {
        raw++
        const p = toPoint(d)
        if (typeof d.id === 'string' && p && distanceMeters(center, p) <= radiusM) seen.set(d.id, p)
      }
      if (isEnd) break
    }
  })
  const ms = Date.now() - started
  return { cells: cells.length, calls, raw, unique: seen.size, capped: Math.min(seen.size, MAX_RESTAURANTS), ms, got429 }
}

async function countSpike(place: string, radiusM: number): Promise<void> {
  const center = await geocode(place)
  console.log(`${place} 중심 ${center.lat},${center.lng} 반경 ${radiusM}m`)
  const cur = await currentMethod(center, radiusM)
  const n = await newMethod(center, radiusM)
  console.log(`  현재 방식: ${cur.count}개 (${cur.calls}회)`)
  console.log(`  새 방식: 셀 ${n.cells} 호출 ${n.calls} 중복제거전 ${n.raw} 중복제거후 ${n.unique} 상한후 ${n.capped} ${n.ms}ms 429=${n.got429}`)
  console.log('  스펙 17 표 행:')
  console.log(`| ${place} | ${radiusM} | ${cur.count} | ${n.calls} | ${n.raw} | ${n.unique} | ${n.capped} | ${(n.ms / 1000).toFixed(1)}초 |`)
}

async function main(): Promise<void> {
  const [mode, place, radius] = process.argv.slice(2)
  if (mode === 'rect') return rectSpike()
  if (mode === 'count' && place && radius) return countSpike(place, Number(radius))
  console.error('사용법: rect | count "<장소>" <반경m>')
  process.exit(1)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
```

- [x] **Step 2: 병용 확인 실행**

Run: `npx tsx scripts/spike-kakao-search.ts rect`
Expected: 세 줄이 찍힌다. 변형 A 줄이 `HTTP 200`, `rect안=docs`(모든 문서가 rect 안), `distance필드=true`, `오름차순=true`면 **변형 A** 채택. 하나라도 아니면 **변형 B** 채택. 결과 줄을 그대로 보관한다.

- [x] **Step 3: 개수 측정 실행 (4회)**

실제 장소 주소는 주인님께 묻는다. 답을 받을 수 없으면 계정에 있는 테스트 장소 주소 "청구로1길 23"을 쓰고 표에 그렇게 적는다.

Run:
```
npx tsx scripts/spike-kakao-search.ts count "강남역" 500
npx tsx scripts/spike-kakao-search.ts count "강남역" 1000
npx tsx scripts/spike-kakao-search.ts count "<실제 장소 주소>" 500
npx tsx scripts/spike-kakao-search.ts count "<실제 장소 주소>" 1000
```
Expected: 각각 마지막 줄에 `| 장소 | 반경 | … |` 표 행이 나온다. `429=false`여야 한다. 1000m 새 방식의 소요 시간이 6초를 넘으면 Task 6의 보고서에 적는다(`maxDuration`이 Task 5에서 30초로 들어간다).

변형 B로 결정됐다면 Step 3 전에 스크립트의 `newMethod` 안 주석대로 rect 셀 파라미터를 `{ rect: job.cell.rect, sort: 'accuracy' }`로 바꾸고 실행한다.

- [x] **Step 4: 일 할당량 확인**

주인님이 직접 한다. https://developers.kakao.com/console/app 에서 앱 "점심 룰렛" 선택 → 왼쪽 메뉴 "쿼터"(또는 "앱 설정 > 쿼터") → "카카오 로컬(Local)" 항목의 일 한도 숫자와 오늘 사용량을 알려 달라고 요청한다. 스펙 17 본문에 적힌 300,000과 다르면 스펙 17 "문제" 절의 숫자와 09-external-api.md 55행의 숫자도 같이 고친다.

- [x] **Step 5: 스펙 17 결과 표 채우기**

`17-restaurant-search-expansion.md`의 "### 결과 (스파이크 뒤 채움)" 절을 아래 형태로 채운다. 값은 Step 2~4의 출력 그대로. `(실제 장소)`는 실제 장소 이름으로 바꾼다.

```markdown
### 결과 (2026-09-07 스파이크)

| 장소 | 반경 | 현재 방식 개수 | 새 방식 호출 수 | 중복 제거 전 | 중복 제거 후 | 200 상한 적용 후 | 소요 시간 |
|---|---|---|---|---|---|---|---|
| 강남역 | 500 | … | … | … | … | … | …초 |
| 강남역 | 1000 | … | … | … | … | … | …초 |
| (실제 장소) | 500 | … | … | … | … | … | …초 |
| (실제 장소) | 1000 | … | … | … | … | … | …초 |

- `rect` + `x/y` + `sort=distance` 병용: 가능/불가. (변형 A 줄 출력: HTTP …, docs=…, rect안=…, distance필드=…, 오름차순=…). 셀 질의는 변형 A/B로 구현한다.
- 동시 5 실행: 429 없음/있음.
- 일 할당량: 카카오 로컬 …회/일, 오늘 사용 …회 (콘솔 확인 …월 …일).
```

- [x] **Step 6: 스크립트가 미추적인지 확인하고 스펙과 계획만 커밋**

Run: `git status --short`
Expected: `?? scripts/spike-kakao-search.ts` 로 보인다. 이 파일은 `git add`에 넣지 않는다.

```bash
git add docs/superpowers/specs/2026-09-04-lunch-roulette/17-restaurant-search-expansion.md docs/superpowers/plans/2026-09-07-restaurant-search-expansion.md
git commit -m "docs: 스펙 17 스파이크 결과 기록과 구현 계획 추가

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gc2BJELpBUT1NKLXAwiwsY"
```

09-external-api.md를 고쳤으면 그 파일도 `git add`에 넣는다.

---

### Task 1: `gridCells` (TDD)

**Files:**
- Create: `src/places/collect.ts`
- Test: `tests/places/collect.test.ts`

**Interfaces:**
- Consumes: `LatLng` (`src/places/types.ts`).
- Produces:
  - `export const GRID_THRESHOLD_M = 500`
  - `export type Cell = { kind: 'radius' } | { kind: 'rect'; rect: string }` — `rect`는 카카오 형식 `x1,y1,x2,y2`(왼쪽 아래 경도,위도,오른쪽 위 경도,위도).
  - `export function gridCells(center: LatLng, radiusM: number): Cell[]` — R ≤ 500이면 `[{ kind: 'radius' }]`, 아니면 남서·남동·북서·북동 순 rect 넷. Task 4가 쓴다.

- [x] **Step 1: 실패하는 테스트 작성** `tests/places/collect.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { GRID_THRESHOLD_M, gridCells } from '@/places/collect'

const CENTER = { lat: 37.5, lng: 127.0 }
const M_PER_DEG_LAT = 111_320

type Rect = { x1: number; y1: number; x2: number; y2: number }

function parseRect(cell: { kind: string; rect?: string }): Rect {
  if (cell.kind !== 'rect' || !cell.rect) throw new Error('rect 셀이 아님')
  const [x1, y1, x2, y2] = cell.rect.split(',').map(Number)
  return { x1, y1, x2, y2 }
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

describe('gridCells', () => {
  it('500m 이하는 radius 셀 하나', () => {
    expect(GRID_THRESHOLD_M).toBe(500)
    expect(gridCells(CENTER, 100)).toEqual([{ kind: 'radius' }])
    expect(gridCells(CENTER, 500)).toEqual([{ kind: 'radius' }])
  })

  it('501m 이상은 rect 셀 넷', () => {
    expect(gridCells(CENTER, 501)).toHaveLength(4)
    expect(gridCells(CENTER, 1000)).toHaveLength(4)
    for (const c of gridCells(CENTER, 800)) {
      expect(c.kind).toBe('rect')
      const r = parseRect(c)
      expect(r.x1).toBeLessThan(r.x2)
      expect(r.y1).toBeLessThan(r.y2)
    }
  })

  it('네 셀은 중심 ±R 정사각형을 빈틈없이 덮고 서로 겹치지 않는다', () => {
    const R = 800
    const rects = gridCells(CENTER, R).map(parseRect)
    const dLat = R / M_PER_DEG_LAT
    const dLng = R / (M_PER_DEG_LAT * Math.cos((CENTER.lat * Math.PI) / 180))
    const W = CENTER.lng - dLng
    const E = CENTER.lng + dLng
    const S = CENTER.lat - dLat
    const N = CENTER.lat + dLat

    // 사분면이 하나씩
    const quadrant = (r: Rect) =>
      `${near(r.x1, W) ? 'W' : near(r.x1, CENTER.lng) ? 'E' : '?'}${near(r.y1, S) ? 'S' : near(r.y1, CENTER.lat) ? 'N' : '?'}`
    expect(rects.map(quadrant).sort()).toEqual(['EN', 'ES', 'WN', 'WS'])

    // 외곽이 정사각형과 일치
    expect(Math.min(...rects.map((r) => r.x1))).toBeCloseTo(W, 9)
    expect(Math.max(...rects.map((r) => r.x2))).toBeCloseTo(E, 9)
    expect(Math.min(...rects.map((r) => r.y1))).toBeCloseTo(S, 9)
    expect(Math.max(...rects.map((r) => r.y2))).toBeCloseTo(N, 9)

    // 넓이 합 = 정사각형 넓이 (빈틈 없음)
    const area = rects.reduce((sum, r) => sum + (r.x2 - r.x1) * (r.y2 - r.y1), 0)
    expect(area).toBeCloseTo((E - W) * (N - S), 12)

    // 겹치지 않음 (모서리만 닿는다)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        const disjoint = a.x2 <= b.x1 || b.x2 <= a.x1 || a.y2 <= b.y1 || b.y2 <= a.y1
        expect(disjoint).toBe(true)
      }
    }

    // 안쪽 경계는 문자열에서 같은 숫자를 쓴다 (셀 사이 빈틈이 부동소수점으로도 생기지 않음)
    const xs = new Set(rects.flatMap((r) => [r.x1, r.x2]))
    const ys = new Set(rects.flatMap((r) => [r.y1, r.y2]))
    expect(xs.size).toBe(3)
    expect(ys.size).toBe(3)
  })

  it('경도 폭은 위도에 따라 cos 보정된다', () => {
    const R = 1000
    const at37 = gridCells({ lat: 37.5, lng: 127.0 }, R).map(parseRect)
    const width = Math.max(...at37.map((r) => r.x2)) - Math.min(...at37.map((r) => r.x1))
    const height = Math.max(...at37.map((r) => r.y2)) - Math.min(...at37.map((r) => r.y1))
    expect(width / height).toBeCloseTo(1 / Math.cos((37.5 * Math.PI) / 180), 6)

    const at0 = gridCells({ lat: 0, lng: 10 }, R).map(parseRect)
    const w0 = Math.max(...at0.map((r) => r.x2)) - Math.min(...at0.map((r) => r.x1))
    const h0 = Math.max(...at0.map((r) => r.y2)) - Math.min(...at0.map((r) => r.y1))
    expect(w0).toBeCloseTo(h0, 9)
    expect(h0).toBeCloseTo((2 * R) / M_PER_DEG_LAT, 9)
  })
})
```

- [x] **Step 2: 실패 확인**

Run: `npx vitest run tests/places/collect.test.ts`
Expected: FAIL. `Failed to resolve import "@/places/collect"` 또는 비슷한 모듈 없음 오류.

- [x] **Step 3: 구현** `src/places/collect.ts`

```ts
import type { LatLng } from './types'

/**
 * 식당 수집의 fetch 없는 순수 함수들 (스펙 17).
 * - gridCells: 반경에 따라 질의 셀을 정한다. 500m 이하 radius 하나, 초과는 2×2 rect.
 * - capByDistance: 중심 거리순으로 정렬하고 상한까지 자른다.
 * - mapWithConcurrency: 동시 실행 제한. 하나가 실패하면 새 작업을 시작하지 않는다.
 */

/** 이 반경까지는 radius 질의 하나, 넘으면 2×2 rect 격자. (스펙 17 수집 알고리즘 1) */
export const GRID_THRESHOLD_M = 500

const M_PER_DEG_LAT = 111_320

export type Cell = { kind: 'radius' } | { kind: 'rect'; rect: string }

/**
 * 중심 ±R 정사각형을 넷으로 나눈 rect 셀. 카카오 rect 형식은 `x1,y1,x2,y2` (왼쪽 아래 → 오른쪽 위).
 * 안쪽 경계는 center.lng / center.lat 값을 그대로 써서 셀 사이에 부동소수점 빈틈이 생기지 않는다.
 */
export function gridCells(center: LatLng, radiusM: number): Cell[] {
  if (radiusM <= GRID_THRESHOLD_M) return [{ kind: 'radius' }]
  const dLat = radiusM / M_PER_DEG_LAT
  const dLng = radiusM / (M_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180))
  const W = center.lng - dLng
  const E = center.lng + dLng
  const S = center.lat - dLat
  const N = center.lat + dLat
  const cx = center.lng
  const cy = center.lat
  return [
    { kind: 'rect', rect: `${W},${S},${cx},${cy}` },
    { kind: 'rect', rect: `${cx},${S},${E},${cy}` },
    { kind: 'rect', rect: `${W},${cy},${cx},${N}` },
    { kind: 'rect', rect: `${cx},${cy},${E},${N}` },
  ]
}
```

- [x] **Step 4: 통과 확인**

Run: `npx vitest run tests/places/collect.test.ts`
Expected: PASS 4개.

- [x] **Step 5: 커밋**

```bash
git add src/places/collect.ts tests/places/collect.test.ts
git commit -m "feat(places): 반경에 따른 질의 셀 계산 gridCells (스펙 17)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gc2BJELpBUT1NKLXAwiwsY"
```

---

### Task 2: `capByDistance` (TDD)

**Files:**
- Modify: `src/places/collect.ts` (끝에 추가)
- Test: `tests/places/collect.test.ts` (끝에 추가)

**Interfaces:**
- Consumes: `distanceMeters` (`src/places/distance.ts`).
- Produces: `export function capByDistance<T extends { google_place_id: string; lat: number; lng: number }>(center: LatLng, list: T[], max: number): T[]` — 입력 배열을 바꾸지 않고 새 배열을 돌려준다. 거리 오름차순, 같은 거리는 `google_place_id` 코드 단위 문자열순(`<` 비교, 로케일 무관). `max`개까지. Task 4가 `FoundRestaurant[]`로 쓴다.

- [x] **Step 1: 실패하는 테스트 추가** `tests/places/collect.test.ts` 끝에

import 줄을 이렇게 바꾼다.

```ts
import { GRID_THRESHOLD_M, capByDistance, gridCells } from '@/places/collect'
```

파일 끝에 추가:

```ts
type Item = { google_place_id: string; lat: number; lng: number }

/** 중심에서 북쪽으로 dLat 만큼 떨어진 항목. 0.001도 ≈ 111m. */
function at(id: string, dLat: number): Item {
  return { google_place_id: id, lat: CENTER.lat + dLat, lng: CENTER.lng }
}

describe('capByDistance', () => {
  it('중심 거리 오름차순으로 정렬한다', () => {
    const list = [at('kakao:far', 0.003), at('kakao:near', 0.001), at('kakao:mid', 0.002)]
    expect(capByDistance(CENTER, list, 10).map((i) => i.google_place_id)).toEqual(['kakao:near', 'kakao:mid', 'kakao:far'])
  })

  it('상한을 넘으면 먼 것부터 버린다', () => {
    const list = [at('kakao:far', 0.003), at('kakao:near', 0.001), at('kakao:mid', 0.002)]
    expect(capByDistance(CENTER, list, 2).map((i) => i.google_place_id)).toEqual(['kakao:near', 'kakao:mid'])
  })

  it('같은 거리는 id 문자열순으로 고정한다', () => {
    const list = [at('kakao:b', 0.001), at('kakao:a', 0.001), at('kakao:10', 0.001)]
    expect(capByDistance(CENTER, list, 10).map((i) => i.google_place_id)).toEqual(['kakao:10', 'kakao:a', 'kakao:b'])
  })

  it('상한 이하면 전부 유지하고 입력 배열은 바꾸지 않는다', () => {
    const list = [at('kakao:far', 0.003), at('kakao:near', 0.001)]
    const copy = [...list]
    const out = capByDistance(CENTER, list, 5)
    expect(out).toHaveLength(2)
    expect(list).toEqual(copy)
    expect(out).not.toBe(list)
  })

  it('빈 입력이면 빈 배열', () => {
    expect(capByDistance(CENTER, [], 200)).toEqual([])
  })
})
```

- [x] **Step 2: 실패 확인**

Run: `npx vitest run tests/places/collect.test.ts`
Expected: FAIL. `capByDistance is not a function` 또는 export 없음.

- [x] **Step 3: 구현** `src/places/collect.ts` 끝에 추가. 파일 맨 위 import에 `distanceMeters`를 넣는다.

```ts
import { distanceMeters } from './distance'
```

```ts
/**
 * 중심 거리 오름차순 정렬 후 max 개까지. 같은 거리는 google_place_id 코드 단위 문자열순으로 고정해
 * 결과를 결정적으로 만든다. (스펙 17 수집 알고리즘 3)
 */
export function capByDistance<T extends { google_place_id: string; lat: number; lng: number }>(
  center: LatLng,
  list: T[],
  max: number,
): T[] {
  const withDistance = list.map((item) => ({ item, d: distanceMeters(center, { lat: item.lat, lng: item.lng }) }))
  withDistance.sort((a, b) => {
    if (a.d !== b.d) return a.d - b.d
    if (a.item.google_place_id === b.item.google_place_id) return 0
    return a.item.google_place_id < b.item.google_place_id ? -1 : 1
  })
  return withDistance.slice(0, Math.max(0, max)).map((w) => w.item)
}
```

- [x] **Step 4: 통과 확인**

Run: `npx vitest run tests/places/collect.test.ts`
Expected: PASS 9개.

- [x] **Step 5: 커밋**

```bash
git add src/places/collect.ts tests/places/collect.test.ts
git commit -m "feat(places): 거리순 정렬과 상한 자르기 capByDistance (스펙 17)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gc2BJELpBUT1NKLXAwiwsY"
```

---

### Task 3: `mapWithConcurrency` (TDD)

**Files:**
- Modify: `src/places/collect.ts` (끝에 추가)
- Test: `tests/places/collect.test.ts` (끝에 추가)

**Interfaces:**
- Produces: `export function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>` — 결과는 입력 순서. 동시에 진행 중인 `fn`은 `limit`개 이하. 하나가 reject하면 아직 시작하지 않은 항목은 시작하지 않고 그 오류로 reject한다. 이미 진행 중인 것은 끝나도 결과를 쓰지 않는다(전체가 reject되므로). `limit`가 1 미만이거나 정수가 아니면 `RangeError`. 빈 입력이면 `[]`. Task 4가 쓴다.

- [x] **Step 1: 실패하는 테스트 추가** `tests/places/collect.test.ts` 끝에

import 줄:

```ts
import { GRID_THRESHOLD_M, capByDistance, gridCells, mapWithConcurrency } from '@/places/collect'
```

파일 끝에 추가:

```ts
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** 매크로태스크 한 번 양보. 시작된 작업이 자리 잡을 시간을 준다. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0))

describe('mapWithConcurrency', () => {
  it('빈 입력이면 빈 배열이고 fn 을 부르지 않는다', async () => {
    const fn = vi.fn(async (n: number) => n)
    await expect(mapWithConcurrency([], 3, fn)).resolves.toEqual([])
    expect(fn).not.toHaveBeenCalled()
  })

  it('결과 순서는 입력 순서와 같다 (완료 순서와 무관)', async () => {
    const ds = [deferred<string>(), deferred<string>(), deferred<string>()]
    const p = mapWithConcurrency([0, 1, 2], 3, (i) => ds[i].promise)
    await tick()
    ds[2].resolve('c')
    ds[0].resolve('a')
    ds[1].resolve('b')
    await expect(p).resolves.toEqual(['a', 'b', 'c'])
  })

  it('fn 은 (item, index) 를 받는다', async () => {
    const out = await mapWithConcurrency(['x', 'y'], 2, async (item, index) => `${item}${index}`)
    expect(out).toEqual(['x0', 'y1'])
  })

  it('동시에 진행 중인 작업이 limit 을 넘지 않는다', async () => {
    const items = [0, 1, 2, 3, 4, 5, 6]
    const ds = items.map(() => deferred<number>())
    let active = 0
    let maxActive = 0
    const started: number[] = []
    const p = mapWithConcurrency(items, 2, async (i) => {
      active++
      started.push(i)
      maxActive = Math.max(maxActive, active)
      const v = await ds[i].promise
      active--
      return v
    })
    await tick()
    expect(started).toEqual([0, 1])
    ds[0].resolve(0)
    await tick()
    expect(started).toEqual([0, 1, 2])
    for (const i of items) ds[i].resolve(i)
    await expect(p).resolves.toEqual(items)
    expect(maxActive).toBe(2)
  })

  it('하나가 reject 하면 아직 시작 안 한 작업은 시작되지 않고 그 오류로 reject 한다', async () => {
    const items = [0, 1, 2, 3, 4, 5]
    const ds = items.map(() => deferred<number>())
    const started: number[] = []
    const p = mapWithConcurrency(items, 2, (i) => {
      started.push(i)
      return ds[i].promise
    })
    const settled = p.catch((e) => e)
    await tick()
    expect(started).toEqual([0, 1])
    const boom = new Error('boom')
    ds[0].reject(boom)
    expect(await settled).toBe(boom)
    // 진행 중이던 1번이 끝나도 2번 이후는 시작하지 않는다
    ds[1].resolve(1)
    await tick()
    expect(started).toEqual([0, 1])
  })

  it('limit 이 1 미만이거나 정수가 아니면 RangeError', async () => {
    await expect(mapWithConcurrency([1], 0, async (n) => n)).rejects.toBeInstanceOf(RangeError)
    await expect(mapWithConcurrency([1], 1.5, async (n) => n)).rejects.toBeInstanceOf(RangeError)
  })
})
```

파일 맨 위 vitest import에 `vi`를 추가한다.

```ts
import { describe, expect, it, vi } from 'vitest'
```

- [x] **Step 2: 실패 확인**

Run: `npx vitest run tests/places/collect.test.ts`
Expected: FAIL. `mapWithConcurrency is not a function`.

- [x] **Step 3: 구현** `src/places/collect.ts` 끝에 추가

```ts
/**
 * items 를 최대 limit 개씩 동시에 fn 으로 처리한다. 결과는 입력 순서.
 * 하나가 reject 하면 아직 시작하지 않은 항목은 시작하지 않고 그 오류로 reject 한다.
 * 이미 진행 중인 항목은 끝나도 결과를 쓰지 않는다(전체가 이미 reject 됐으므로). (스펙 17 E6, E7)
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError(`limit must be a positive integer: ${limit}`)
  const results: R[] = new Array(items.length)
  let next = 0
  let failed = false

  async function worker(): Promise<void> {
    while (!failed) {
      const i = next++
      if (i >= items.length) return
      try {
        results[i] = await fn(items[i], i)
      } catch (e) {
        failed = true
        throw e
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
```

- [x] **Step 4: 통과 확인**

Run: `npx vitest run tests/places/collect.test.ts`
Expected: PASS 15개.

- [x] **Step 5: 타입·린트 확인 후 커밋**

Run: `npx tsc --noEmit && npm run lint`
Expected: 오류 0.

```bash
git add src/places/collect.ts tests/places/collect.test.ts
git commit -m "feat(places): 동시 실행 제한 mapWithConcurrency, 하나 실패 시 새 작업 중단 (스펙 17)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gc2BJELpBUT1NKLXAwiwsY"
```

---

### Task 4: `kakao.ts` `searchRestaurants` 개편과 `kakao.test.ts` 개편

**Files:**
- Modify: `src/places/kakao.ts` (`searchRestaurants`와 `kakaoGet` 시그니처. `geocode`, `parsePage`, `toLatLng`는 그대로)
- Test: `tests/places/kakao.test.ts` (전면 개편. `kakao.geocode` describe 블록은 그대로)

**Interfaces:**
- Consumes: `gridCells`, `capByDistance`, `mapWithConcurrency`, `Cell` (`src/places/collect.ts`, Task 1~3). `fetchExternalJson`, `finiteNumber`, `isRecord` (`src/places/http.ts`). `distanceMeters`. `DEFAULT_HOURS`. Task 0의 변형 A/B 결정.
- Produces:
  - `export const KEYWORDS = ['음식점', '한식', '중식', '일식', '양식', '분식', '아시아음식', '패스트푸드', '술집'] as const` — 테스트가 import한다.
  - `searchRestaurants(center: LatLng, radiusM: number): Promise<FoundRestaurant[]>` 시그니처 불변. 결과는 거리순 최대 200개.
  - 서버 로그 형식(고정 문자열, 테스트가 단언한다):
    - 성공: `[kakao.searchRestaurants] radius=<R> cells=<n> calls=<n> raw=<n> unique=<n> capped=<n> ms=<n>` (console.info 한 줄)
    - 실패: `[kakao.searchRestaurants] job failed cell=<i> keyword=<k>: <메시지>` (console.error 한 줄, 메시지는 `ExternalApiError.message` 그대로)

셀 질의 파라미터는 Task 0 결정에 따른다.

| 변형 | rect 셀 파라미터 | 테스트 단언 |
|---|---|---|
| A | `rect`, `x`, `y`, `sort=distance` | 800m 케이스에서 `sort === 'distance'`, `x === '127'` |
| B | `rect`, `sort=accuracy` (x/y 없음) | 800m 케이스에서 `sort === 'accuracy'`, `x === null` |

아래 코드는 변형 A로 적었다. 변형 B면 표시한 두 곳만 바꾼다.

- [x] **Step 1: 테스트 개편** `tests/places/kakao.test.ts` 전체를 아래로 바꾼다. `kakao.geocode` describe 블록은 기존 내용 그대로 옮긴다.

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KEYWORDS, geocode, searchRestaurants } from '@/places/kakao'
import { ExternalApiError } from '@/places/types'

const CENTER = { lat: 37.5, lng: 127.0 }
const KEYWORD_PATH = '/v2/local/search/keyword.json'

type Doc = Record<string, unknown>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function page(documents: Doc[], isEnd: boolean) {
  return { documents, meta: { is_end: isEnd, total_count: documents.length } }
}

function doc(id: string, lat = CENTER.lat, lng = CENTER.lng, extra: Doc = {}): Doc {
  return { id, place_name: `식당 ${id}`, road_address_name: `도로명 ${id}`, x: String(lng), y: String(lat), ...extra }
}

/** 요청 URL에서 이 테스트가 보는 파라미터만 뽑는다. */
type Q = {
  path: string
  query: string | null
  category: string | null
  rect: string | null
  radius: string | null
  page: number
  sort: string | null
  x: string | null
  y: string | null
  size: string | null
}

function parseCall(url: string): Q {
  const u = new URL(url)
  const g = (k: string) => u.searchParams.get(k)
  return {
    path: u.pathname,
    query: g('query'),
    category: g('category_group_code'),
    rect: g('rect'),
    radius: g('radius'),
    page: Number(g('page') ?? '1'),
    sort: g('sort'),
    x: g('x'),
    y: g('y'),
    size: g('size'),
  }
}

let fetchMock: ReturnType<typeof vi.fn>

function calls(): Q[] {
  return fetchMock.mock.calls.map((c) => parseCall(c[0] as string))
}

/**
 * 모의 fetch 를 URL 파라미터로 분기한다.
 * 핸들러가 Doc[] 를 돌려주면 is_end=true 한 페이지, { docs, isEnd } 면 그대로, Response 면 그대로 응답.
 */
function route(handler: (q: Q) => Doc[] | { docs: Doc[]; isEnd: boolean } | Response): void {
  fetchMock.mockImplementation(async (url: string) => {
    const out = handler(parseCall(url))
    if (out instanceof Response) return out
    if (Array.isArray(out)) return jsonResponse(page(out, true))
    return jsonResponse(page(out.docs, out.isEnd))
  })
}

const SORTED_KEYWORDS = [...KEYWORDS].sort()

beforeEach(() => {
  vi.stubEnv('KAKAO_REST_API_KEY', 'test-kakao-key')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('kakao.searchRestaurants', () => {
  it('500m 이하: 키워드 9개를 radius 로 질의하고 rect 는 없다', async () => {
    route((q) => (q.query === '음식점' ? [doc('1')] : []))
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['kakao:1'])

    const qs = calls()
    expect(qs).toHaveLength(9)
    expect(qs.map((q) => q.query).sort()).toEqual(SORTED_KEYWORDS)
    for (const q of qs) {
      expect(q.path).toBe(KEYWORD_PATH)
      expect(q.category).toBe('FD6')
      expect(q.radius).toBe('500')
      expect(q.rect).toBeNull()
      expect(q.sort).toBe('distance')
      expect(q.x).toBe('127')
      expect(q.y).toBe('37.5')
      expect(q.size).toBe('15')
      expect(q.page).toBe(1)
    }
  })

  it('800m: rect 4개 × 키워드 9개 = 36 작업, radius 없음, 성공 로그 한 줄', async () => {
    route(() => [])
    await searchRestaurants(CENTER, 800)

    const qs = calls()
    expect(qs).toHaveLength(36)
    const rects = new Set(qs.map((q) => q.rect))
    expect(rects.size).toBe(4)
    expect(rects.has(null)).toBe(false)
    for (const rect of rects) {
      expect(qs.filter((q) => q.rect === rect).map((q) => q.query).sort()).toEqual(SORTED_KEYWORDS)
    }
    for (const q of qs) {
      expect(q.radius).toBeNull()
      expect(q.category).toBe('FD6')
      expect(q.sort).toBe('distance') // 변형 B: 'accuracy'
      expect(q.x).toBe('127') // 변형 B: toBeNull()
    }
    expect(console.info).toHaveBeenCalledTimes(1)
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/^\[kakao\.searchRestaurants\] radius=800 cells=4 calls=36 raw=0 unique=0 capped=0 ms=\d+$/),
    )
  })

  it('작업별로 is_end 면 다음 페이지를 요청하지 않고 최대 3페이지', async () => {
    route((q) => {
      if (q.query === '한식') return { docs: [doc(`h${q.page}`)], isEnd: false }
      if (q.query === '중식') return { docs: [doc(`c${q.page}`)], isEnd: q.page === 2 }
      return []
    })
    const found = await searchRestaurants(CENTER, 500)
    const pagesOf = (keyword: string) => calls().filter((q) => q.query === keyword).map((q) => q.page)
    expect(pagesOf('한식')).toEqual([1, 2, 3])
    expect(pagesOf('중식')).toEqual([1, 2])
    expect(pagesOf('일식')).toEqual([1])
    expect(calls()).toHaveLength(3 + 2 + 7)
    expect(found.map((f) => f.google_place_id).sort()).toEqual(['kakao:c1', 'kakao:c2', 'kakao:h1', 'kakao:h2', 'kakao:h3'])
  })

  it('여러 키워드에 같은 id 가 나와도 결과에는 한 번만', async () => {
    route((q) => (q.query === '음식점' || q.query === '한식' || q.query === '술집' ? [doc('same')] : []))
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['kakao:same'])
  })

  it('200개를 넘으면 거리순 200개', async () => {
    // 키워드 9개 × 3페이지 × 15개 = 405개, 전부 다른 id, 중심에서 1.1m 씩 멀어진다 (최대 약 450m).
    route((q) => {
      const k = KEYWORDS.indexOf(q.query as (typeof KEYWORDS)[number])
      const docs = Array.from({ length: 15 }, (_, i) => {
        const n = k * 45 + (q.page - 1) * 15 + i
        return doc(`n${n}`, CENTER.lat + n * 0.00001)
      })
      return { docs, isEnd: q.page === 3 }
    })
    const found = await searchRestaurants(CENTER, 500)
    expect(calls()).toHaveLength(27)
    expect(found).toHaveLength(200)
    expect(found[0].google_place_id).toBe('kakao:n0')
    expect(found[199].google_place_id).toBe('kakao:n199')
    for (let i = 1; i < found.length; i++) expect(found[i].lat).toBeGreaterThanOrEqual(found[i - 1].lat)
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/ radius=500 cells=1 calls=27 raw=405 unique=405 capped=200 /),
    )
  })

  it('작업 하나가 429 면 전체 ExternalApiError, status 보존, 메시지에 키 없음, 실패 로그', async () => {
    route((q) =>
      q.query === '술집' ? new Response('quota exceeded ' + 'x'.repeat(500), { status: 429 }) : [],
    )
    const err = await searchRestaurants(CENTER, 500).catch((e) => e)
    expect(err).toBeInstanceOf(ExternalApiError)
    expect(err.status).toBe(429)
    expect(err.message).toContain('HTTP 429')
    expect(err.message).toContain('quota exceeded')
    expect(err.message.length).toBeLessThan(300)
    expect(err.message).not.toContain('test-kakao-key')
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[kakao\.searchRestaurants\] job failed cell=0 keyword=술집: Kakao .*HTTP 429/),
    )
    expect(console.error).toHaveBeenCalledWith(expect.not.stringContaining('test-kakao-key'))
  })

  it('요청에 API 키 헤더를 붙이고 캐시하지 않는다', async () => {
    route(() => [])
    await searchRestaurants(CENTER, 500)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('KakaoAK test-kakao-key')
    expect(init.cache).toBe('no-store')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('반경 밖 식당과 중복 id 를 걸러낸다', async () => {
    // 위도 0.01도 ≈ 1.1km
    route((q) =>
      q.query === '음식점'
        ? [doc('near'), doc('far', CENTER.lat + 0.01), doc('near'), doc('near2', CENTER.lat + 0.001)]
        : [],
    )
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['kakao:near', 'kakao:near2'])
  })

  it('좌표가 숫자가 아니거나 id 가 없는 문서는 버린다', async () => {
    route((q) =>
      q.query === '음식점'
        ? [
            doc('ok'),
            { ...doc('nan'), x: 'abc' },
            { ...doc('empty'), y: '' },
            { ...doc('missing'), x: undefined },
            { ...doc('noid'), id: undefined },
            { ...doc('emptyid'), id: '' },
          ]
        : [],
    )
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['kakao:ok'])
    expect(found[0]).toMatchObject({
      name: '식당 ok',
      address: '도로명 ok',
      lat: CENTER.lat,
      lng: CENTER.lng,
      hours_source: 'default',
    })
    expect(found[0].hours).not.toBeNull()
  })

  it('road_address_name 이 없으면 address_name 을 쓴다', async () => {
    route((q) =>
      q.query === '음식점' ? [doc('x', CENTER.lat, CENTER.lng, { road_address_name: '', address_name: '지번 주소' })] : [],
    )
    const found = await searchRestaurants(CENTER, 500)
    expect(found[0].address).toBe('지번 주소')
  })

  it('네트워크 오류(TypeError)는 ExternalApiError 로 바뀐다', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const err = await searchRestaurants(CENTER, 500).catch((e) => e)
    expect(err).toBeInstanceOf(ExternalApiError)
    expect(err.message).toContain('fetch failed')
  })

  it('타임아웃(AbortError)도 ExternalApiError 로 바뀐다', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
  })

  it('최상위 형태가 다르면 ExternalApiError', async () => {
    // 작업이 동시에 여러 개 돌므로 호출마다 새 Response 를 만든다 (본문은 한 번만 읽을 수 있다)
    fetchMock.mockImplementation(async () => jsonResponse({ meta: { is_end: true } }))
    await expect(searchRestaurants(CENTER, 500)).rejects.toThrow(/unexpected response shape/)

    fetchMock.mockImplementation(async () => jsonResponse({ documents: 'nope' }))
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)

    fetchMock.mockImplementation(async () => jsonResponse(null))
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
  })

  it('JSON 이 아닌 본문은 ExternalApiError', async () => {
    fetchMock.mockImplementation(async () => new Response('<html>', { status: 200 }))
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
  })

  it('API 키가 없으면 fetch 전에 ExternalApiError', async () => {
    vi.stubEnv('KAKAO_REST_API_KEY', '')
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('kakao.geocode', () => {
  it('주소 검색 결과가 있으면 그 좌표를 돌려준다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(page([{ x: '127.1', y: '37.6' }], true)))
    await expect(geocode('서울시 어딘가')).resolves.toEqual({ lat: 37.6, lng: 127.1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/v2/local/search/address.json')
  })

  it('주소 검색이 비면 키워드 검색으로 폴백한다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(page([], true)))
      .mockResolvedValueOnce(jsonResponse(page([{ x: '127.2', y: '37.7' }], true)))
    await expect(geocode('회사')).resolves.toEqual({ lat: 37.7, lng: 127.2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toContain('/v2/local/search/keyword.json')
  })

  it('둘 다 비면 null', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(page([], true)))
    await expect(geocode('없는 곳')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('좌표가 NaN 이면 결과로 쓰지 않는다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(page([{ x: 'abc', y: '37.6' }], true)))
      .mockResolvedValueOnce(jsonResponse(page([{ x: 'abc', y: 'def' }], true)))
    await expect(geocode('이상한 곳')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('최상위 형태가 다르면 ExternalApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'bad' }))
    await expect(geocode('x')).rejects.toBeInstanceOf(ExternalApiError)
  })
})
```

- [x] **Step 2: 실패 확인**

Run: `npx vitest run tests/places/kakao.test.ts`
Expected: FAIL. `KEYWORDS` export 없음으로 여러 개 실패. `kakao.geocode` 5개는 PASS.

- [x] **Step 3: 구현** `src/places/kakao.ts`

파일 전체를 아래로 바꾼다. `geocode`, `parsePage`, `toLatLng`, `apiKey`는 본문이 그대로이고 `kakaoGet`만 키를 인자로 받는다.

```ts
import { capByDistance, gridCells, mapWithConcurrency, type Cell } from './collect'
import { distanceMeters } from './distance'
import { fetchExternalJson, finiteNumber, isRecord } from './http'
import { ExternalApiError, type FoundRestaurant, type LatLng } from './types'
import { DEFAULT_HOURS } from '@/config/default-hours'

/**
 * 카카오 로컬 API 어댑터 (스펙 09 대안, D17).
 * - 주소 → 좌표: /v2/local/search/address.json, 실패 시 /v2/local/search/keyword.json
 * - 식당 검색: /v2/local/search/keyword.json, category_group_code=FD6, 페이지당 15개, 작업당 최대 3페이지.
 *   카카오는 질의당 45개가 상한이라 키워드 9개 × 셀(500m 이하 radius 1개, 초과 2×2 rect 4개)로 나눠
 *   동시 5개씩 호출하고 id 로 합친 뒤 거리순 200개까지 남긴다. (스펙 17, D18)
 * 카카오는 영업시간을 주지 않으므로 hours 는 DEFAULT_HOURS 를 넣고 hours_source 를 'default' 로 표시한다.
 * 정확한 영업시간은 data/hours-overrides.json 으로 덮어쓴다. (스펙 10)
 * 저장 키는 `kakao:<id>` 형식이다.
 */

/** 카카오 카테고리 2단계 이름. "음식점"은 세분류에 안 걸리는 가게용. (스펙 17 E2) */
export const KEYWORDS = ['음식점', '한식', '중식', '일식', '양식', '분식', '아시아음식', '패스트푸드', '술집'] as const
const MAX_PAGES = 3
const PAGE_SIZE = 15
const MAX_RESTAURANTS = 200
const CONCURRENCY = 5
const KEYWORD_PATH = '/v2/local/search/keyword.json'

function apiKey(): string {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key) throw new ExternalApiError('KAKAO_REST_API_KEY is not set')
  return key
}

type KakaoPage = { documents: Record<string, unknown>[]; isEnd: boolean }

/** 최상위 형태 검증: documents 가 배열이어야 한다. meta.is_end 는 없으면 true 로 본다(더 요청하지 않음). */
function parsePage(path: string, json: unknown): KakaoPage {
  if (!isRecord(json) || !Array.isArray(json.documents)) {
    throw new ExternalApiError(`Kakao ${path} unexpected response shape`)
  }
  const meta = isRecord(json.meta) ? json.meta : null
  const isEnd = meta?.is_end === undefined ? true : meta.is_end === true
  return { documents: json.documents.filter(isRecord), isEnd }
}

async function kakaoGet(key: string, path: string, params: Record<string, string | number>): Promise<KakaoPage> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  const json = await fetchExternalJson(`Kakao ${path}`, `https://dapi.kakao.com${path}?${qs}`, {
    headers: { Authorization: `KakaoAK ${key}` },
  })
  return parsePage(path, json)
}

/** 카카오 문서의 x(경도)/y(위도) 문자열을 좌표로. 유한하지 않으면 null. */
function toLatLng(doc: Record<string, unknown>): LatLng | null {
  const lat = finiteNumber(doc.y)
  const lng = finiteNumber(doc.x)
  if (lat === null || lng === null) return null
  return { lat, lng }
}

export async function geocode(address: string): Promise<LatLng | null> {
  const key = apiKey()
  const byAddress = await kakaoGet(key, '/v2/local/search/address.json', { query: address, size: 1 })
  const a = byAddress.documents[0]
  if (a) {
    const point = toLatLng(a)
    if (point) return point
  }

  const byKeyword = await kakaoGet(key, KEYWORD_PATH, { query: address, size: 1 })
  const k = byKeyword.documents[0]
  if (k) return toLatLng(k)
  return null
}

/** (셀, 키워드) 한 쌍이 작업 하나. cellIndex 는 실패 로그용. */
type Job = { cellIndex: number; cell: Cell; keyword: string }
type JobResult = { documents: Record<string, unknown>[]; calls: number }

/** 셀 종류에 따른 위치 파라미터. rect 셀도 x/y 와 sort=distance 를 같이 보낸다(스파이크 항목 1에서 확인). */
function cellParams(center: LatLng, radiusM: number, cell: Cell): Record<string, string | number> {
  if (cell.kind === 'radius') {
    return { x: center.lng, y: center.lat, radius: Math.min(Math.max(radiusM, 0), 20000), sort: 'distance' }
  }
  return { rect: cell.rect, x: center.lng, y: center.lat, sort: 'distance' } // 변형 B: { rect: cell.rect, sort: 'accuracy' }
}

/** 작업 하나: 페이지 1→3 순차, is_end 면 멈춤. 실패하면 셀 번호와 키워드를 로그에 남기고 그대로 던진다. */
async function runJob(key: string, center: LatLng, radiusM: number, job: Job): Promise<JobResult> {
  const documents: Record<string, unknown>[] = []
  let calls = 0
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      calls++
      const res = await kakaoGet(key, KEYWORD_PATH, {
        query: job.keyword,
        category_group_code: 'FD6',
        size: PAGE_SIZE,
        page,
        ...cellParams(center, radiusM, job.cell),
      })
      documents.push(...res.documents)
      if (res.isEnd) break
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[kakao.searchRestaurants] job failed cell=${job.cellIndex} keyword=${job.keyword}: ${message}`)
    throw e
  }
  return { documents, calls }
}

/** 카카오 문서 하나를 FoundRestaurant 로. id 나 좌표가 없거나 반경 밖이면 null. */
function toFound(center: LatLng, radiusM: number, p: Record<string, unknown>): FoundRestaurant | null {
  if (typeof p.id !== 'string' || p.id === '') return null
  const point = toLatLng(p)
  if (!point) return null
  if (distanceMeters(center, point) > radiusM) return null
  return {
    google_place_id: `kakao:${p.id}`,
    name: typeof p.place_name === 'string' ? p.place_name : '',
    address:
      (typeof p.road_address_name === 'string' && p.road_address_name) ||
      (typeof p.address_name === 'string' && p.address_name) ||
      '',
    lat: point.lat,
    lng: point.lng,
    hours: DEFAULT_HOURS,
    hours_source: 'default',
  }
}

export async function searchRestaurants(center: LatLng, radiusM: number): Promise<FoundRestaurant[]> {
  const key = apiKey()
  const started = Date.now()
  const cells = gridCells(center, radiusM)
  const jobs: Job[] = cells.flatMap((cell, cellIndex) => KEYWORDS.map((keyword) => ({ cellIndex, cell, keyword })))

  const results = await mapWithConcurrency(jobs, CONCURRENCY, (job) => runJob(key, center, radiusM, job))

  const seen = new Map<string, FoundRestaurant>()
  let raw = 0
  let calls = 0
  for (const r of results) {
    calls += r.calls
    raw += r.documents.length
    for (const p of r.documents) {
      const found = toFound(center, radiusM, p)
      if (found && !seen.has(found.google_place_id)) seen.set(found.google_place_id, found)
    }
  }
  const capped = capByDistance(center, [...seen.values()], MAX_RESTAURANTS)
  console.info(
    `[kakao.searchRestaurants] radius=${radiusM} cells=${cells.length} calls=${calls} raw=${raw} unique=${seen.size} capped=${capped.length} ms=${Date.now() - started}`,
  )
  return capped
}
```

변형 B면 `cellParams`의 rect 분기를 `return { rect: cell.rect, sort: 'accuracy' }`로 바꾸고 그 위 주석도 "rect 셀은 x/y 를 보내지 않는다(스파이크 항목 1에서 병용 불가 확인)"로 고친다.

- [x] **Step 4: 통과 확인**

Run: `npx vitest run tests/places/kakao.test.ts`
Expected: PASS 20개 (searchRestaurants 15 + geocode 5).

- [x] **Step 5: 전체 테스트·타입·린트**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: 전부 통과. `tests/places/google.test.ts`와 `tests/actions/*.test.ts`는 건드리지 않았으므로 그대로 통과해야 한다. `kakao.ts`의 `parsePage` 등에서 unused 경고가 나면 그 자리에서 고친다.

- [x] **Step 6: 커밋**

```bash
git add src/places/kakao.ts tests/places/kakao.test.ts
git commit -m "feat(places): 카카오 식당 수집을 키워드 9개 × 셀 작업으로 확장, 동시 5, 거리순 200개 (스펙 17)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gc2BJELpBUT1NKLXAwiwsY"
```

---

### Task 5: 반경 상한 1000과 서버 액션 시간 여유

**Files:**
- Modify: `src/actions/places.ts:35` (`RADIUS_MAX`)
- Modify: `src/app/(app)/places/PlaceForm.tsx:79` (`max={2000}`)
- Modify: `src/app/(app)/places/page.tsx` (`maxDuration` 추가)

**Interfaces:**
- Produces: `clampRadius`가 1000을 넘는 값을 1000으로 자른다. 폼 입력 상한 1000. 장소 페이지의 서버 액션 실행 한도 30초.

이 태스크는 상수 변경이라 새 단위 테스트를 만들지 않는다. `clampRadius`는 `'use server'` 파일 안의 비공개 함수라 직접 테스트할 수 없고, 폼의 `max`는 브라우저 검증이다. Task 6에서 실제 화면으로 확인한다.

- [x] **Step 1: 서버 상한**

`src/actions/places.ts`에서

```ts
const RADIUS_MAX = 2000
```

를

```ts
/** 스펙 17 E5: 1000m 초과는 3×3 격자가 필요해 호출이 너무 많다. 기존 1000m 초과 장소는 그대로 둔다. */
const RADIUS_MAX = 1000
```

로 바꾼다.

- [x] **Step 2: 폼 상한**

`src/app/(app)/places/PlaceForm.tsx`에서

```tsx
          max={2000}
```

를

```tsx
          max={1000}
```

로 바꾼다.

- [x] **Step 3: 서버 액션 시간 여유**

`src/app/(app)/places/page.tsx`의

```ts
export const dynamic = 'force-dynamic'
```

바로 아래에 추가한다.

```ts
/** createPlace 가 카카오를 최대 108회 호출한다(스펙 17). Vercel 기본 10초에 가까워서 여유를 둔다. */
export const maxDuration = 30
```

- [x] **Step 4: 검증**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: 전부 통과.

- [x] **Step 5: 커밋**

```bash
git add src/actions/places.ts "src/app/(app)/places/PlaceForm.tsx" "src/app/(app)/places/page.tsx"
git commit -m "feat(places): 반경 상한 2000→1000m, 장소 페이지 maxDuration 30초 (스펙 17 E5)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gc2BJELpBUT1NKLXAwiwsY"
```

---

### Task 6: 통합 검증, 실제 키 확인, 문서 갱신, 배포 확인

**Files:**
- Delete (미추적): `scripts/spike-kakao-search.ts`
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/17-restaurant-search-expansion.md` (코드 구조 표, 구현 완료 표시)
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/14-userflow-happy-case.md:24` (F2 행)
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/13-backlog.md:79` (B10 처리 메모)
- Modify: `docs/superpowers/handoff/2026-09-04-session-handoff.md` (다음 할 일)
- Modify: `docs/superpowers/plans/2026-09-07-restaurant-search-expansion.md` (체크박스, 결과 절)

**Interfaces:**
- Consumes: Task 0~5 전부 커밋된 상태. `.env.local`의 `KAKAO_REST_API_KEY`, Supabase 키, `ROULETTE_ALLOW_ANY_TIME`은 무관.

- [x] **Step 1: 빌드**

Run: `npm run build`
Expected: 성공. `maxDuration` 경고가 없어야 한다.

- [x] **Step 2: 로컬에서 실제 키로 장소 생성**

Run: `npm run dev` (백그라운드)
브라우저(Chrome 도구)로 http://localhost:3000/login 에 가서 로그인한 뒤 /places 에서 장소를 만든다.

| 이름 | 주소 | 반경 | 확인할 것 |
|---|---|---|---|
| 스펙17 검증 500 | 강남역 | 500 | 성공 문구 "장소를 추가했습니다. 식당 N곳을 찾았습니다"의 N이 Task 0 표의 "강남역 500 상한 적용 후"와 같거나 ±10% 안 |
| 스펙17 검증 1000 | 강남역 | 1000 | N이 Task 0 표의 "강남역 1000 상한 적용 후"와 같거나 ±10% 안. 200 초과 없음. 응답까지 10초 이내 |

반경 입력에 1500을 넣으면 브라우저가 폼을 막는지(`max=1000`) 확인한다. 개발 서버 콘솔에서 `[kakao.searchRestaurants] radius=1000 cells=4 calls=… ms=…` 한 줄이 보이는지 확인하고 그 줄을 보고서에 옮긴다. 각 장소 상세(/places/<id>)에서 식당 목록 수가 N과 같은지 확인한다.

만든 테스트 장소 2개는 지우지 않는다(삭제는 주인님 확인 후, 작업 규칙). 보고서에 이름을 적는다.

- [ ] **Step 3: 스파이크 스크립트 삭제** (마무리 단계로 이월)

Run: `rm scripts/spike-kakao-search.ts && git status --short`
Expected: `scripts/` 관련 줄이 없다. `git log --all --oneline -- scripts/spike-kakao-search.ts`가 아무것도 출력하지 않는다(한 번도 커밋되지 않음).

- [x] **Step 4: 스펙 17 갱신**

"## 코드 구조" 표 끝에 행을 추가한다.

```markdown
| `src/app/(app)/places/page.tsx` | 수정 | `export const maxDuration = 30`. 서버 액션이 최악 6초 + 지오코딩 + DB라 Vercel 기본 10초에 여유를 둔다. 구현 중 추가 |
```

"## 코드 구조" 제목 바로 아래 문단 앞에 한 줄을 넣는다.

```markdown
2026-09-07 구현 완료. 계획은 [../../plans/2026-09-07-restaurant-search-expansion.md](../../plans/2026-09-07-restaurant-search-expansion.md). 로컬 확인 결과: 강남역 500m N곳, 1000m N곳(Step 2 값).
```

- [x] **Step 5: 스펙 14 갱신 (구현 뒤에만)**

`14-userflow-happy-case.md` 24행의

```markdown
| 흐름 | F2 | 장소 생성 | 주소를 좌표로 바꾸고 반경 안 식당을 최대 60곳 수집해 저장 | 06 |
```

를

```markdown
| 흐름 | F2 | 장소 생성 | 주소를 좌표로 바꾸고 반경 안 식당을 거리순 최대 200곳 수집해 저장 | 06, [17-restaurant-search-expansion.md](17-restaurant-search-expansion.md) |
```

로 바꾼다. 41행의 "식당 N곳을 찾았습니다" 문구는 그대로다(E9). 그 밖의 문장에 60이나 45가 남아 있는지 `grep -n "60곳\|45" 14-userflow-happy-case.md`로 확인하고 있으면 같은 식으로 고친다.

- [x] **Step 6: 백로그와 인수인계 갱신**

`13-backlog.md` 79행

```markdown
- B10 식당 수집 45개 상한 넘기기 → 스펙 17로 설계 확정 (2026-09-07). 구현은 17의 계획을 따른다.
```

를

```markdown
- B10 식당 수집 45개 상한 넘기기 → 스펙 17로 설계 확정, 구현·배포 완료 (2026-09-07).
```

로 바꾼다.

`docs/superpowers/handoff/2026-09-04-session-handoff.md` "## 다음 할 일 (우선순위)" 목록 끝에 추가한다.

```markdown
10. ~~스펙 17 식당 수집 확장~~ 2026-09-07 구현·배포 완료. 키워드 9개 × 셀(500m 초과 2×2 rect), 동시 5, 거리순 200개, 반경 상한 1000m. 스파이크 결과는 스펙 17 결과 표. 기존 45개로 만든 장소는 지우고 다시 만들어야 늘어난다(E8, B3).
```

같은 파일 "## 문서 위치"의 스펙 줄 "01~16"을 "01~17. 17은 식당 수집 확장"으로 고친다.

- [x] **Step 7: 문서 커밋과 push**

```bash
git add docs/superpowers/specs/2026-09-04-lunch-roulette/17-restaurant-search-expansion.md docs/superpowers/specs/2026-09-04-lunch-roulette/14-userflow-happy-case.md docs/superpowers/specs/2026-09-04-lunch-roulette/13-backlog.md docs/superpowers/handoff/2026-09-04-session-handoff.md docs/superpowers/plans/2026-09-07-restaurant-search-expansion.md
git commit -m "docs: 스펙 17 구현 완료 반영, 14 해피케이스 F2 최대 200곳, 13 B10 완료, 인수인계 갱신

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Gc2BJELpBUT1NKLXAwiwsY"
git push origin main
```

인수인계 파일에는 이 계획과 무관한 기존 미커밋 수정 2줄이 있다. 그 내용을 `git diff docs/superpowers/handoff/2026-09-04-session-handoff.md`로 먼저 읽고, 이 커밋에 함께 들어가도 되는 문서 수정이면 그대로 포함하고 보고서에 적는다.

- [ ] **Step 8: 프로덕션 배포 확인** (마무리 단계로 이월)

push로 Vercel Git 연동 배포가 시작된다. `npx vercel ls lunch-roulette` 또는 Vercel MCP `list_deployments`로 최신 배포가 Ready인지 확인한다. https://lunch-roulette-sooty.vercel.app/places 가 200으로 열리는지 확인한다.

프로덕션에서 1000m 장소 생성은 Google 로그인이 필요해 주인님이 직접 한다("주인님이 직접 할 일" 참고).

- [x] **Step 9: 보고**

바꾼 파일, 커밋 해시 목록, `npm test` 출력의 마지막 요약 줄, Step 2의 로그 한 줄과 식당 수, 남겨 둔 테스트 장소 이름, 스펙과 다르게 한 것(`GRID_THRESHOLD_M` 위치, `maxDuration` 추가), 배포 상태.

---

### Task 7: RPC 식당 상한 100 → 300 (마이그레이션 0006, 실행 중 추가)

Task 6 로컬 확인에서 발견. 0005의 심층 방어(`> 100`)가 스펙 17 E4의 200개와 충돌해 `createPlace`가 UNEXPECTED. `supabase/migrations/0006_rpc_restaurant_cap_300.sql`로 상한만 300으로 올리고 스펙 17 코드 구조 표에 적었다. 앱은 `MAX_RESTAURANTS = 200`까지만 보내므로 DB 상한은 여유를 두어 300으로 잡아, 앱 상한을 올릴 때 DB가 먼저 막지 않게 했다. 적용은 주인님 승인 후 Supabase MCP `apply_migration` 또는 대시보드 SQL 편집기.

---

## 주인님이 직접 할 일

1. Task 0 Step 3: 실제 쓰는 장소 주소 하나를 알려 주기.
2. Task 0 Step 4: 카카오 디벨로퍼스 콘솔에서 카카오 로컬 API 일 할당량 숫자 확인.
3. Task 6 뒤: 프로덕션(https://lunch-roulette-sooty.vercel.app)에서 반경 1000m 장소를 하나 만들어 식당 수와 응답 시간을 확인. 10초 넘게 걸리거나 "지금은 장소를 만들 수 없습니다"가 나오면 Vercel 런타임 로그의 `[kakao.searchRestaurants]` 줄을 알려 주기.
4. 로컬 테스트 장소 "스펙17 검증 500", "스펙17 검증 1000"과 프로덕션 테스트 장소의 삭제 여부 결정.

## 자체 검토 결과

- 스펙 커버리지: 셀 결정(Task 1), 작업·호출·동시 5(Task 3, 4), 합치기·상한·id순(Task 2, 4), 실패 전체 거절(Task 3, 4), 로그 두 형식(Task 4), 코드 구조 네 파일(Task 1~5), 테스트 목록 전부(Task 1~4), 스파이크 세 항목과 결과 표(Task 0), 14 구현 뒤 갱신(Task 6). E8, E9, 제외 목록은 손대지 않는 것으로 충족.
- 타입 일관성: `Cell`은 Task 1 정의 그대로 Task 4 `cellParams`와 `Job`에서 쓴다. `capByDistance`의 제약 `{ google_place_id, lat, lng }`는 `FoundRestaurant`가 만족한다. `mapWithConcurrency`의 `fn(item, index)` 시그니처를 Task 4는 `(job) => …`로 첫 인자만 쓴다.
- 스펙과 다른 점: `GRID_THRESHOLD_M`을 `collect.ts`에 둔 것, `maxDuration = 30` 추가. 둘 다 Task 6에서 스펙 17에 적는다.
