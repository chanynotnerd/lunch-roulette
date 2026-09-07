# 세션 K2: 클라이언트 (initialView, stampMarkerHtml, KakaoMap, MarkerCard, RecordsList, RecordsScreen)

[← 인덱스](README.md). Global Constraints와 병렬 단계 규칙은 인덱스를 따른다. 선행: K0 커밋.

**소유 파일:** `src/app/(app)/records/initial-view.ts`, `stamp-marker.ts`, `KakaoMap.tsx`, `MarkerCard.tsx`, `RecordsList.tsx`, `RecordsScreen.tsx`, `tests/app/initial-view.test.ts`, `tests/app/stamp-marker.test.ts`. 그 밖의 파일은 읽기만 한다. `src/actions/` 아래와 `page.tsx`는 쓰지 않는다.

**중요:** 이 세션의 컴포넌트는 K3 전까지 화면에 연결되지 않는다. 검증은 단위 테스트, `npx tsc --noEmit`, `npm run lint`로만 한다. 브라우저 확인은 K3가 한다. K1의 `src/actions/records-helpers.ts`, `records.ts`는 import하지 않는다(동시에 작업 중). 타입은 K0의 `src/actions/records-types.ts`에서만 가져온다.

---

### Task K2-1: initialView (TDD)

**Files:**
- Create: `src/app/(app)/records/initial-view.ts`
- Test: `tests/app/initial-view.test.ts`

**Interfaces:**
- Consumes: `InitialView`, `LatLng`, `MapMarker` (`src/actions/records-types.ts`, K0).
- Produces: `initialView(markers: MapMarker[], fallbackCenter: LatLng): InitialView`, 상수 `SINGLE_ZOOM = 4`, `EMPTY_ZOOM = 5`. Task K2-5가 쓴다. 스펙 16 M4.

- [ ] **Step 1: 실패하는 테스트 작성** `tests/app/initial-view.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { EMPTY_ZOOM, SINGLE_ZOOM, initialView } from '@/app/(app)/records/initial-view'
import type { MapMarker } from '@/actions/records-types'

const FALLBACK = { lat: 37.5665, lng: 126.978 }

function marker(id: string, lat: number, lng: number): MapMarker {
  return { restaurantId: id, name: id, address: '', lat, lng, visits: 1, level: 2, levelName: '익숙', lastVisitDate: '2026-09-04' }
}

describe('initialView', () => {
  it('마커가 없으면 기본 중심, 확대 5', () => {
    expect(initialView([], FALLBACK)).toEqual({ kind: 'center', center: FALLBACK, zoom: EMPTY_ZOOM })
    expect(EMPTY_ZOOM).toBe(5)
  })

  it('마커가 하나면 그 지점 중심, 확대 4', () => {
    expect(initialView([marker('a', 37.5, 127.03)], FALLBACK)).toEqual({
      kind: 'center',
      center: { lat: 37.5, lng: 127.03 },
      zoom: SINGLE_ZOOM,
    })
    expect(SINGLE_ZOOM).toBe(4)
  })

  it('마커가 둘 이상이면 좌표 전부를 담은 범위', () => {
    const out = initialView([marker('a', 37.5, 127.03), marker('b', 37.51, 127.04), marker('c', 37.49, 127.0)], FALLBACK)
    expect(out).toEqual({
      kind: 'bounds',
      points: [
        { lat: 37.5, lng: 127.03 },
        { lat: 37.51, lng: 127.04 },
        { lat: 37.49, lng: 127.0 },
      ],
    })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/app/initial-view.test.ts`
Expected: FAIL. `Failed to resolve import "@/app/(app)/records/initial-view"`.

- [ ] **Step 3: 구현** `src/app/(app)/records/initial-view.ts`

```ts
import type { InitialView, LatLng, MapMarker } from '@/actions/records-types'

/** 카카오 확대 단계. 숫자가 작을수록 가깝다. 4 ≈ 100m 축척, 5 ≈ 250m. */
export const SINGLE_ZOOM = 4
export const EMPTY_ZOOM = 5

/**
 * 지도를 처음 열 때 보여 줄 범위. 스펙 16 M4.
 * 0개: 기본 중심. 1개: 그 마커 중심. 2개 이상: 마커 전부가 들어오는 범위.
 */
export function initialView(markers: MapMarker[], fallbackCenter: LatLng): InitialView {
  if (markers.length === 0) return { kind: 'center', center: fallbackCenter, zoom: EMPTY_ZOOM }
  if (markers.length === 1) {
    return { kind: 'center', center: { lat: markers[0].lat, lng: markers[0].lng }, zoom: SINGLE_ZOOM }
  }
  return { kind: 'bounds', points: markers.map((m) => ({ lat: m.lat, lng: m.lng })) }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/app/initial-view.test.ts`
Expected: PASS 3건.

---

### Task K2-2: stampMarkerHtml (TDD)

**Files:**
- Create: `src/app/(app)/records/stamp-marker.ts`
- Test: `tests/app/stamp-marker.test.ts`

**Interfaces:**
- Produces: `stampMarkerHtml(input: StampMarkerInput): string`, `type StampMarkerInput = { visits: number; level: number; name: string; levelName: string; selected: boolean }`. 카카오 CustomOverlay의 content로 쓸 `<button>` HTML 문자열. Task K2-3이 쓴다. 클래스는 K0의 `stamp-marker`, `l1`~`l5`, `selected`. 문구는 스펙 16 "마커 라벨".

- [ ] **Step 1: 실패하는 테스트 작성** `tests/app/stamp-marker.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { stampMarkerHtml } from '@/app/(app)/records/stamp-marker'

const base = { visits: 7, level: 4, name: '김밥천국', levelName: '찐단골', selected: false }

describe('stampMarkerHtml', () => {
  it('button 하나에 레벨 클래스, 방문 횟수 숫자, 접근성 라벨을 넣는다', () => {
    const html = stampMarkerHtml(base)
    expect(html).toBe(
      '<button type="button" class="stamp-marker l4" aria-label="김밥천국, 레벨 4 찐단골, 7회 방문" aria-pressed="false">7</button>',
    )
  })

  it('레벨 1~5는 l1~l5 클래스', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(stampMarkerHtml({ ...base, level })).toContain(`class="stamp-marker l${level}"`)
    }
  })

  it('레벨이 범위를 벗어나면 1~5로 자른다', () => {
    expect(stampMarkerHtml({ ...base, level: 0 })).toContain('l1"')
    expect(stampMarkerHtml({ ...base, level: 9 })).toContain('l5"')
  })

  it('선택되면 selected 클래스와 aria-pressed="true"', () => {
    const html = stampMarkerHtml({ ...base, selected: true })
    expect(html).toContain('class="stamp-marker l4 selected"')
    expect(html).toContain('aria-pressed="true"')
  })

  it('식당 이름의 HTML 특수문자를 이스케이프한다', () => {
    const html = stampMarkerHtml({ ...base, name: '<b>"김밥" & 분식\'</b>' })
    expect(html).not.toContain('<b>')
    expect(html).toContain('aria-label="&lt;b&gt;&quot;김밥&quot; &amp; 분식&#39;&lt;/b&gt;, 레벨 4 찐단골, 7회 방문"')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/app/stamp-marker.test.ts`
Expected: FAIL. 모듈 없음.

- [ ] **Step 3: 구현** `src/app/(app)/records/stamp-marker.ts`

```ts
export type StampMarkerInput = {
  visits: number
  level: number
  name: string
  levelName: string
  selected: boolean
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

/**
 * 도장 마커 HTML. 카카오 CustomOverlay의 content로 쓴다. 스펙 16 시각 디자인 3, 접근성.
 * 숫자는 방문 횟수, 클래스 l1~l5가 크기와 테두리를 정한다. 클릭 처리는 KakaoMap이 붙인다.
 */
export function stampMarkerHtml(input: StampMarkerInput): string {
  const level = Math.min(Math.max(Math.trunc(input.level), 1), 5)
  const cls = `stamp-marker l${level}${input.selected ? ' selected' : ''}`
  const label = escapeHtml(`${input.name}, 레벨 ${level} ${input.levelName}, ${input.visits}회 방문`)
  return `<button type="button" class="${cls}" aria-label="${label}" aria-pressed="${input.selected}">${input.visits}</button>`
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/app/stamp-marker.test.ts`
Expected: PASS 5건.

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(app)/records/initial-view.ts" "src/app/(app)/records/stamp-marker.ts" tests/app/initial-view.test.ts tests/app/stamp-marker.test.ts
git commit -m "feat(map): 초기 화면 결정과 도장 마커 HTML 순수 함수 (스펙 16)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D9kAoPJFsiCpzGBkUqNKkH"
```

---

### Task K2-3: KakaoMap 컴포넌트

**Files:**
- Create: `src/app/(app)/records/KakaoMap.tsx`

**Interfaces:**
- Consumes: `window.kakao`, `KakaoMapInstance`, `KakaoOverlay` (`src/types/kakao-maps.d.ts`, K0). `InitialView`, `MapMarker` (K0). `stampMarkerHtml` (Task K2-2). 클래스 `map-canvas`, `map-loading`, `map-box`, `map-fail` (K0).
- Produces: `default KakaoMap(props)`, `type PanTarget = { id: string; nonce: number }`. props:
  - `jsKey: string | null` — null이면 SDK를 넣지 않고 바로 실패 상태.
  - `markers: MapMarker[]`, `selectedId: string | null`, `initialView: InitialView`
  - `panTarget: PanTarget | null` — nonce가 바뀔 때마다 그 id 마커로 `panTo`.
  - `onSelect(id: string)`, `onDeselect()`
  - Task K2-5가 쓴다. 카카오 객체는 이 파일 밖으로 나가지 않는다.

- [ ] **Step 1: 파일 생성**

```tsx
'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { InitialView, MapMarker } from '@/actions/records-types'
import type { KakaoMapInstance, KakaoOverlay } from '@/types/kakao-maps'
import { stampMarkerHtml } from './stamp-marker'

/**
 * 카카오맵 SDK 로드, 지도 생성, 초기 범위, 마커 그리기. 스펙 16 KakaoMap.
 * SDK는 autoload=false로 넣고 kakao.maps.load 콜백 안에서만 지도를 만든다.
 * 카카오 객체는 이 파일 밖으로 나가지 않는다. 실패는 브라우저 상태이며 console.error만 남긴다.
 */

const SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js'
const INIT_TIMEOUT_MS = 10_000
const BOUNDS_PADDING = 48
const SELECTED_Z = 100

export type PanTarget = { id: string; nonce: number }

type Props = {
  jsKey: string | null
  markers: MapMarker[]
  selectedId: string | null
  initialView: InitialView
  panTarget: PanTarget | null
  onSelect: (id: string) => void
  onDeselect: () => void
}

type Status = 'loading' | 'ready' | 'failed'

export default function KakaoMap({ jsKey, markers, selectedId, initialView, panTarget, onSelect, onDeselect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMapInstance | null>(null)
  const overlaysRef = useRef<KakaoOverlay[]>([])
  const [status, setStatus] = useState<Status>(jsKey ? 'loading' : 'failed')

  // 지도 이벤트 리스너는 한 번만 등록하므로 최신 콜백을 ref로 본다.
  const onSelectRef = useRef(onSelect)
  const onDeselectRef = useRef(onDeselect)
  onSelectRef.current = onSelect
  onDeselectRef.current = onDeselect

  // 초기 범위는 처음 한 번만 쓴다. 이후 prop이 바뀌어도 지도를 다시 맞추지 않는다.
  const initialViewRef = useRef(initialView)

  const init = useCallback(() => {
    const maps = window.kakao?.maps
    if (!maps || !containerRef.current || mapRef.current) return
    maps.load(() => {
      const el = containerRef.current
      if (!el || mapRef.current) return
      const view = initialViewRef.current
      const first = view.kind === 'center' ? view.center : view.points[0]
      const map = new maps.Map(el, {
        center: new maps.LatLng(first.lat, first.lng),
        level: view.kind === 'center' ? view.zoom : 4,
      })
      if (view.kind === 'bounds') {
        const bounds = new maps.LatLngBounds()
        for (const p of view.points) bounds.extend(new maps.LatLng(p.lat, p.lng))
        map.setBounds(bounds, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING)
      }
      maps.event.addListener(map, 'click', () => onDeselectRef.current())
      mapRef.current = map
      setStatus('ready')
    })
  }, [])

  // 이미 로드된 SDK(같은 탭에서 다시 진입)면 스크립트 onLoad가 안 오므로 여기서 초기화한다. 10초 안에 지도가 없으면 실패.
  useEffect(() => {
    if (!jsKey) return
    if (window.kakao?.maps) init()
    const timer = window.setTimeout(() => {
      if (mapRef.current) return
      console.error('[KakaoMap] 지도 초기화 시간 초과')
      setStatus('failed')
    }, INIT_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [jsKey, init])

  // 마커 갱신: 목록이나 선택이 바뀌면 전부 지우고 다시 그린다. 수십 개 수준이라 충분하다.
  useEffect(() => {
    const maps = window.kakao?.maps
    const map = mapRef.current
    if (status !== 'ready' || !maps || !map) return
    for (const o of overlaysRef.current) o.setMap(null)
    overlaysRef.current = markers.map((m) => {
      const selected = m.restaurantId === selectedId
      const wrap = document.createElement('div')
      wrap.innerHTML = stampMarkerHtml({
        visits: m.visits,
        level: m.level,
        name: m.name,
        levelName: m.levelName,
        selected,
      })
      const button = wrap.firstElementChild as HTMLElement
      button.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectRef.current(m.restaurantId)
      })
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(m.lat, m.lng),
        content: button,
        xAnchor: 0.5,
        yAnchor: 0.5,
        clickable: true,
        // 선택된 것이 가장 위, 그다음은 레벨이 낮을수록 위(큰 도장이 작은 도장을 덮지 않게).
        zIndex: selected ? SELECTED_Z : 10 - m.level,
      })
      overlay.setMap(map)
      return overlay
    })
  }, [status, markers, selectedId])

  // 목록에서 항목을 고르면 그 마커로 이동.
  useEffect(() => {
    const maps = window.kakao?.maps
    const map = mapRef.current
    if (!panTarget || status !== 'ready' || !maps || !map) return
    const m = markers.find((x) => x.restaurantId === panTarget.id)
    if (m) map.panTo(new maps.LatLng(m.lat, m.lng))
  }, [panTarget, status, markers])

  return (
    <>
      {jsKey && (
        <Script
          src={`${SDK_URL}?appkey=${encodeURIComponent(jsKey)}&autoload=false`}
          strategy="afterInteractive"
          onLoad={init}
          onError={() => {
            console.error('[KakaoMap] SDK 스크립트 로드 실패')
            setStatus('failed')
          }}
        />
      )}
      <div ref={containerRef} className="map-canvas" role="region" aria-label="다녀온 식당 지도" />
      {status === 'loading' && (
        <p className="map-loading" aria-live="polite">
          지도를 불러오는 중
        </p>
      )}
      {status === 'failed' && (
        <p className="map-box map-fail" role="status">
          지도를 표시할 수 없습니다. 목록으로 볼 수 있습니다
        </p>
      )}
    </>
  )
}
```

- [ ] **Step 2: 타입 검사와 린트**

Run: `npx tsc --noEmit; npm run lint`
Expected: 자기 파일에서 오류 0. `react-hooks/exhaustive-deps` 경고가 나면 의존성 배열을 위 코드 그대로 두고 그 줄에 `// eslint-disable-next-line react-hooks/exhaustive-deps`를 붙이지 말고, 경고 내용을 보고서에 적는다(ref 갱신은 의도한 것이다).

---

### Task K2-4: MarkerCard와 RecordsList

**Files:**
- Create: `src/app/(app)/records/MarkerCard.tsx`
- Create: `src/app/(app)/records/RecordsList.tsx`

**Interfaces:**
- Consumes: `MapMarker`, `RecordRow` (K0). `formatVisitMeta`, `formatSlotDate` (`src/lib/format.ts`, K0). `LevelStamps({ level, levelName, nextIn, compact? })` (`src/app/components/LevelStamps.tsx`). 클래스 `map-box`, `map-ticket`, `ticket-main`, `ticket-name`, `ticket-address`, `ticket-stub`, `small`, `map-sheet`, `page-title`, `muted`, `stubs`, `stub`, `stub-pick`, `stub-meta`, `stub-name`.
- Produces: `default MarkerCard({ marker: MapMarker })`, `default RecordsList({ records: RecordRow[]; onPick(restaurantId: string): void; adminSlot?: ReactNode })`. Task K2-5가 쓴다.

- [ ] **Step 1: `MarkerCard.tsx` 생성**

```tsx
import type { MapMarker } from '@/actions/records-types'
import LevelStamps from '@/app/components/LevelStamps'
import { formatVisitMeta } from '@/lib/format'

/** 선택된 마커의 식권 카드. 스펙 16 M3. 닫기 버튼은 없다(지도 빈 곳 탭 또는 Esc). */
export default function MarkerCard({ marker }: { marker: MapMarker }) {
  return (
    <div className="map-box map-ticket" role="status">
      <div className="ticket-main">
        <p className="ticket-name">{marker.name}</p>
        <p className="ticket-address">{marker.address}</p>
        <p className="small">{formatVisitMeta(marker.visits, marker.lastVisitDate)}</p>
      </div>
      <div className="ticket-stub">
        <LevelStamps level={marker.level} levelName={marker.levelName} nextIn={null} compact />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `RecordsList.tsx` 생성**

세션 C가 `page.tsx`에 만든 목록 JSX를 옮긴 것이다. 항목이 버튼이 되고, 열릴 때 제목으로 포커스가 간다. 문구는 그대로다.

```tsx
'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import type { RecordRow } from '@/actions/records-types'
import LevelStamps from '@/app/components/LevelStamps'
import { formatSlotDate } from '@/lib/format'

type Props = {
  records: RecordRow[]
  onPick: (restaurantId: string) => void
  /** 관리자 초기화 버튼(서버 컴포넌트). 페이지가 만들어 넘긴다. */
  adminSlot?: ReactNode
}

/** 날짜별 기록 목록 오버레이. 스펙 07 S4, 15 식권 더미, 16 M2. 플로팅 버튼이 닫기 역할이므로 aria-modal은 두지 않는다. */
export default function RecordsList({ records, onPick, adminSlot }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  return (
    <section className="map-sheet" role="dialog" aria-labelledby="records-title">
      <h1 id="records-title" ref={titleRef} tabIndex={-1} className="page-title">
        기록
      </h1>
      {adminSlot}
      {records.length === 0 ? (
        <p className="muted">아직 기록이 없습니다. 홈에서 룰렛을 돌리면 여기에 쌓입니다</p>
      ) : (
        <ul className="stubs">
          {records.map((r) => (
            <li key={`${r.slotDate}-${r.slot}`} className="stub">
              <button type="button" className="stub-pick" onClick={() => onPick(r.restaurantId)}>
                <span className="stub-meta">
                  {formatSlotDate(r.slotDate)} {r.slotLabel}, {r.placeName}
                </span>
                <span className="stub-name">{r.restaurantName}</span>
                <LevelStamps level={r.levelAtThatTime} levelName={r.levelName} nextIn={null} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 3: 타입 검사와 린트**

Run: `npx tsc --noEmit; npm run lint`
Expected: 자기 파일에서 오류 0.

---

### Task K2-5: RecordsScreen

**Files:**
- Create: `src/app/(app)/records/RecordsScreen.tsx`

**Interfaces:**
- Consumes: `RecordsScreenData` (K0). `initialView` (Task K2-1). `KakaoMap`, `PanTarget` (Task K2-3). `MarkerCard`, `RecordsList` (Task K2-4). 클래스 `map-screen`, `map-box`, `map-notice`, `map-fab`.
- Produces: `default RecordsScreen({ data: RecordsScreenData; kakaoJsKey: string | null; adminSlot?: ReactNode })`. K3의 `page.tsx`가 쓴다.

- [ ] **Step 1: 파일 생성**

```tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RecordsScreenData } from '@/actions/records-types'
import KakaoMap, { type PanTarget } from './KakaoMap'
import MarkerCard from './MarkerCard'
import RecordsList from './RecordsList'
import { initialView } from './initial-view'

type Props = {
  data: RecordsScreenData
  kakaoJsKey: string | null
  adminSlot?: ReactNode
}

/**
 * 기록 탭 = 전체 화면 지도 + 플로팅 버튼 + 식권 카드 + 목록 오버레이. 스펙 16 화면 구성.
 * 상태는 두 개뿐: 선택된 식당 id, 목록 열림 여부. 지도 이동 요청은 panTarget으로 KakaoMap에 전달한다.
 */
export default function RecordsScreen({ data, kakaoJsKey, adminSlot }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [panTarget, setPanTarget] = useState<PanTarget | null>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  const view = useMemo(() => initialView(data.markers, data.fallbackCenter), [data.markers, data.fallbackCenter])
  const selected = data.markers.find((m) => m.restaurantId === selectedId) ?? null

  const closeList = useCallback(() => {
    setListOpen(false)
    // 오버레이가 사라진 뒤 플로팅 버튼으로 포커스 복귀 (스펙 16 접근성)
    requestAnimationFrame(() => fabRef.current?.focus())
  }, [])

  // Esc: 목록이 열려 있으면 목록을, 아니면 카드를 닫는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (listOpen) closeList()
      else if (selectedId) setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listOpen, selectedId, closeList])

  // 목록 항목 탭: 목록 닫고 그 식당 선택, 지도를 그 마커로 이동. 마커가 없는 식당(좌표 없음)이면 닫기만.
  const pick = (restaurantId: string) => {
    closeList()
    if (!data.markers.some((m) => m.restaurantId === restaurantId)) return
    setSelectedId(restaurantId)
    setPanTarget((prev) => ({ id: restaurantId, nonce: (prev?.nonce ?? 0) + 1 }))
  }

  return (
    <div className="map-screen">
      <KakaoMap
        jsKey={kakaoJsKey}
        markers={data.markers}
        selectedId={selectedId}
        initialView={view}
        panTarget={panTarget}
        onSelect={setSelectedId}
        onDeselect={() => setSelectedId(null)}
      />
      {data.markers.length === 0 && !listOpen && (
        <p className="map-box map-notice">아직 기록이 없습니다. 홈에서 룰렛을 돌리면 여기에 쌓입니다</p>
      )}
      {selected && !listOpen && <MarkerCard marker={selected} />}
      {listOpen && <RecordsList records={data.records} onPick={pick} adminSlot={adminSlot} />}
      <button
        ref={fabRef}
        type="button"
        className="map-box map-fab"
        aria-label={listOpen ? '지도로 돌아가기' : '기록 목록 보기'}
        aria-expanded={listOpen}
        onClick={() => (listOpen ? closeList() : setListOpen(true))}
      >
        {listOpen ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 타입 검사, 린트, 전체 테스트**

Run: `npx tsc --noEmit; npm run lint; npm test`
Expected: 자기 파일에서 오류 0, 테스트 전부 PASS(기존 + K2 8건). K1이 동시에 작업 중이라 `src/actions/` 쪽 오류가 잠깐 보일 수 있다. 보고서에 적고 넘어간다.

- [ ] **Step 3: 커밋**

```bash
git add "src/app/(app)/records/KakaoMap.tsx" "src/app/(app)/records/MarkerCard.tsx" "src/app/(app)/records/RecordsList.tsx" "src/app/(app)/records/RecordsScreen.tsx"
git commit -m "feat(map): 카카오 지도, 도장 마커, 식권 카드, 목록 오버레이 컴포넌트 (스펙 16)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D9kAoPJFsiCpzGBkUqNKkH"
```

- [ ] **Step 4: 보고**

바꾼 파일, 커밋 해시 2개, 테스트 결과(명령 출력 그대로), 부족한 것(클래스, 타입 선언, 문구), 린트 경고(특히 hooks 의존성), 남의 파일에서 본 오류, 스펙과 다르게 한 것과 이유를 적어 보고한다. 브라우저 확인은 하지 않았다고 명시한다.
