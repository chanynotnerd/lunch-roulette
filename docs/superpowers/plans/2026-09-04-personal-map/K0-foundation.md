# 세션 K0: 기반 (공용 타입, 카카오 타입 선언, CSS 클래스, formatVisitMeta, 환경변수 예시)

[← 인덱스](README.md). Global Constraints는 인덱스를 따른다. 선행: 없음. **main 세션이 직접 실행하고 커밋한다.** K1, K2가 이 파일들에 의존한다.

**소유 파일:** `src/actions/records-types.ts`, `src/types/kakao-maps.d.ts`, `src/app/globals.css`, `src/lib/format.ts`, `tests/lib/format.test.ts`, `.env.example`. 계획 디렉터리와 `.claude/agents/map-*.md`도 이 세션 커밋에 넣는다.

---

### Task K0-1: 공용 타입

**Files:**
- Create: `src/actions/records-types.ts`

**Interfaces:**
- Produces: `RecordRow`, `MapMarker`, `InitialView`, `RecordsScreenData`, `LatLng`(재수출), `SEOUL_CITY_HALL`. K1이 만들고 K2가 소비한다. 타입만 있고 실행 코드는 상수 하나뿐이라 서버·클라이언트 어디서든 import할 수 있다.

- [ ] **Step 1: 파일 생성**

```ts
import type { LatLng } from '@/places/types'
import type { Slot } from '@/rules/types'

export type { LatLng }

/** 날짜별 기록 한 줄. 스펙 07 S4. restaurantId는 목록 항목 탭 → 마커 선택에 쓴다(스펙 16). */
export type RecordRow = {
  slotDate: string
  slot: Slot
  slotLabel: string
  placeName: string
  restaurantId: string
  restaurantName: string
  levelAtThatTime: number
  levelName: string
}

/** 식당 하나 = 마커 하나. 스펙 16 M1. visits는 그 식당의 confirmed 행 수(= 경험치). */
export type MapMarker = {
  restaurantId: string
  name: string
  address: string
  lat: number
  lng: number
  visits: number
  level: number
  levelName: string
  /** 마지막 confirmed 행의 slot_date (YYYY-MM-DD) */
  lastVisitDate: string
}

/** 지도를 처음 열 때 보여 줄 범위. 스펙 16 M4. zoom은 카카오 확대 단계(작을수록 가깝다). */
export type InitialView =
  | { kind: 'center'; center: LatLng; zoom: number }
  | { kind: 'bounds'; points: LatLng[] }

/** loadRecordsScreen이 돌려주는 것. 페이지가 그대로 RecordsScreen에 넘긴다. */
export type RecordsScreenData = {
  records: RecordRow[]
  markers: MapMarker[]
  /** 기록이 없을 때 지도 중심. 첫 장소 좌표, 없으면 서울시청. */
  fallbackCenter: LatLng
}

/** 장소도 없을 때 쓰는 기본 중심. 스펙 16 M4. */
export const SEOUL_CITY_HALL: LatLng = { lat: 37.5665, lng: 126.978 }
```

- [ ] **Step 2: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 오류 0.

---

### Task K0-2: 카카오맵 SDK 타입 선언

**Files:**
- Create: `src/types/kakao-maps.d.ts`

**Interfaces:**
- Produces: `window.kakao` 전역과 `KakaoMapInstance`, `KakaoOverlay`, `KakaoLatLng`, `KakaoLatLngBounds` 타입. K2의 `KakaoMap.tsx`만 쓴다. 스펙 16이 정한 다섯 가지(`load`, `Map`, `LatLng`, `LatLngBounds`, `CustomOverlay`, `event.addListener`)만 선언한다. 더 필요하면 K2가 보고서에 적고 K3가 추가한다.

- [ ] **Step 1: 파일 생성**

```ts
/**
 * 카카오맵 JavaScript SDK 중 이 앱이 쓰는 것만 선언한다. 스펙 16 M6.
 * 타입 패키지를 깔지 않는다. 여기 없는 API를 쓰려면 이 파일에 먼저 추가한다.
 * SDK는 autoload=false로 넣고 kakao.maps.load(콜백) 안에서만 Map 등을 만든다.
 */

export type KakaoLatLng = {
  getLat(): number
  getLng(): number
}

export type KakaoLatLngBounds = {
  extend(point: KakaoLatLng): void
}

export type KakaoMapInstance = {
  setCenter(point: KakaoLatLng): void
  setLevel(level: number): void
  panTo(point: KakaoLatLng): void
  setBounds(
    bounds: KakaoLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ): void
  relayout(): void
}

export type KakaoOverlay = {
  setMap(map: KakaoMapInstance | null): void
  setZIndex(zIndex: number): void
}

export type KakaoOverlayOptions = {
  position: KakaoLatLng
  content: HTMLElement | string
  xAnchor?: number
  yAnchor?: number
  zIndex?: number
  /** true면 오버레이 탭이 지도 click 이벤트로 번지지 않는다. */
  clickable?: boolean
}

export type KakaoMapsNamespace = {
  load(callback: () => void): void
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  LatLngBounds: new () => KakaoLatLngBounds
  CustomOverlay: new (options: KakaoOverlayOptions) => KakaoOverlay
  event: {
    addListener(target: object, type: string, handler: (...args: unknown[]) => void): void
  }
}

declare global {
  interface Window {
    kakao?: { maps?: KakaoMapsNamespace }
  }
}
```

- [ ] **Step 2: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 오류 0. (`tsconfig.json`의 `include`에 `**/*.ts`가 있어 자동으로 잡힌다.)

---

### Task K0-3: CSS 클래스

**Files:**
- Modify: `src/app/globals.css` (파일 끝에 추가)

**Interfaces:**
- Produces: 클래스 `map-screen`, `map-canvas`, `map-loading`, `map-box`, `map-notice`, `map-fail`, `map-fab`, `map-ticket`, `map-sheet`, `stub-pick`, `stamp-marker`(+ `l1`~`l5`, `selected`). K2가 쓴다. 기존 `ticket-main`, `ticket-name`, `ticket-address`, `ticket-stub`, `stubs`, `stub`, `stub-meta`, `stub-name`, `page-title`, `muted`, `small`, `alert`, `stamps`는 그대로 재사용한다.
- 주의: 기존 `.stamp`(도장 5칸의 12px 점)와 이름이 겹치지 않게 마커는 `.stamp-marker`다.

- [ ] **Step 1: 파일 끝에 아래를 추가**

```css
/* 퍼스널 맵 (스펙 16). 기록 화면만 .page 여백을 벗어나 하단 탭 위까지 채운다. */
.map-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: var(--tabbar-h);
  max-width: 480px;
  margin: 0 auto;
  background: var(--rule);
  overflow: hidden;
}

.map-canvas {
  width: 100%;
  height: 100%;
}

.map-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--muted);
  pointer-events: none;
}

/* 지도 위 요소 공통: 흰 바탕, 검은 테두리 2겹. 그림자 없음. (스펙 16 시각 디자인 2) */
.map-box {
  background: var(--paper);
  color: var(--ink);
  border: 2px solid var(--ink);
  box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--ink);
}

.map-notice {
  position: absolute;
  left: 20px;
  right: 20px;
  top: 20px;
  padding: 12px 14px;
  font-size: var(--text-sm);
  z-index: 3;
}

.map-fail {
  position: absolute;
  left: 20px;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  padding: 16px;
  text-align: center;
  z-index: 3;
}

/* 플로팅 버튼. 항상 오른쪽 위 고정. 목록 오버레이보다 위. (스펙 16 M7) */
.map-fab {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 48px;
  height: 48px;
  padding: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  font: inherit;
  z-index: 7;
}

.map-fab svg {
  width: 22px;
  height: 22px;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: square;
  fill: none;
}

.map-fab:focus-visible {
  outline: 3px solid var(--seal);
  outline-offset: 4px;
}

/* 선택된 마커의 식권 카드. 하단 탭 위 16px. */
.map-ticket {
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 16px;
  display: grid;
  grid-template-columns: 1fr auto;
  z-index: 4;
}

/* 목록 오버레이. 지도를 완전히 덮는다. 플로팅 버튼(z 7)만 위에 남는다. */
.map-sheet {
  position: absolute;
  inset: 0;
  background: var(--paper);
  overflow-y: auto;
  padding: 24px 20px 32px;
  display: grid;
  gap: 24px;
  align-content: start;
  z-index: 6;
}

.map-sheet .page-title {
  padding-right: 64px; /* 플로팅 버튼 자리 */
  outline: none;
}

/* 목록 항목을 버튼으로. 식권 더미 모양은 .stub이 그대로 낸다. */
.stub-pick {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.stub-pick:focus-visible {
  outline: 3px solid var(--seal);
  outline-offset: 4px;
}

/* 도장 마커. 숫자는 방문 횟수, 크기와 테두리는 레벨. (스펙 16 시각 디자인 3) */
.stamp-marker {
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 50%;
  border: 2px solid var(--seal);
  background: var(--seal);
  color: var(--paper);
  font-family: var(--font-display);
  line-height: 1;
  cursor: pointer;
}

.stamp-marker.l1 { width: 32px; height: 32px; font-size: 16px; }
.stamp-marker.l2 { width: 36px; height: 36px; font-size: 16px; }
.stamp-marker.l3 { width: 40px; height: 40px; font-size: 18px; }
.stamp-marker.l4 { width: 44px; height: 44px; font-size: 19px; border: 3px solid var(--seal-deep); }
.stamp-marker.l5 { width: 48px; height: 48px; font-size: 20px; border: 3px solid var(--seal-deep); }

.stamp-marker.selected {
  box-shadow: 0 0 0 3px var(--paper), 0 0 0 5px var(--ink);
}

.stamp-marker:focus-visible {
  outline: 3px solid var(--seal);
  outline-offset: 6px;
}
```

- [ ] **Step 2: 린트**

Run: `npm run lint`
Expected: 오류 0. (CSS는 린트 대상이 아니지만 다른 파일이 멀쩡한지 확인한다.)

---

### Task K0-4: formatVisitMeta (TDD)

**Files:**
- Modify: `src/lib/format.ts`
- Test: `tests/lib/format.test.ts`

**Interfaces:**
- Consumes: 기존 `ISO_DATE` 정규식(파일 안에 있음).
- Produces: `formatVisitMeta(visits: number, isoDate: string): string`. `(7, '2026-09-04')` → `'7회 방문, 마지막 방문 9월 4일'`. 연도는 뺀다(스펙 16 문구). K2의 `MarkerCard`가 쓴다.

- [ ] **Step 1: 실패하는 테스트 추가** `tests/lib/format.test.ts` 끝에

```ts
import { formatVisitMeta } from '@/lib/format'

describe('formatVisitMeta', () => {
  it('방문 횟수와 연도 없는 마지막 방문일을 잇는다', () => {
    expect(formatVisitMeta(7, '2026-09-04')).toBe('7회 방문, 마지막 방문 9월 4일')
  })

  it('월과 일의 앞 0을 뗀다', () => {
    expect(formatVisitMeta(1, '2026-01-09')).toBe('1회 방문, 마지막 방문 1월 9일')
    expect(formatVisitMeta(12, '2026-12-25')).toBe('12회 방문, 마지막 방문 12월 25일')
  })

  it('날짜 형식이 다르면 날짜 부분에 입력을 그대로 쓴다', () => {
    expect(formatVisitMeta(2, '어제')).toBe('2회 방문, 마지막 방문 어제')
  })
})
```

(파일 맨 위의 `import { formatSlotDate } from '@/lib/format'`를 `import { formatSlotDate, formatVisitMeta } from '@/lib/format'`로 합쳐도 된다. import가 두 줄이어도 동작한다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/lib/format.test.ts`
Expected: FAIL. `formatVisitMeta is not a function` 또는 export 없음 오류. 기존 `formatSlotDate` 3건은 PASS.

- [ ] **Step 3: 구현** `src/lib/format.ts` 끝에 추가

```ts
/** 'N회 방문, 마지막 방문 M월 D일'. 연도는 뺀다(카드가 좁다). 형식이 다르면 날짜 부분에 입력 그대로. 스펙 16 문구. */
export function formatVisitMeta(visits: number, isoDate: string): string {
  const m = ISO_DATE.exec(isoDate)
  const when = m ? `${Number(m[2])}월 ${Number(m[3])}일` : isoDate
  return `${visits}회 방문, 마지막 방문 ${when}`
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/lib/format.test.ts`
Expected: PASS 6건.

---

### Task K0-5: 환경변수 예시

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: `KAKAO_REST_API_KEY=` 줄 아래에 추가**

```
# 카카오맵 JavaScript SDK 키(브라우저 노출). 카카오 앱의 "JavaScript 키". Web 플랫폼에 사이트 도메인 등록 필요. 스펙 16.
NEXT_PUBLIC_KAKAO_JS_KEY=
```

`.env.local`에 실제 값을 넣는 것은 주인님이 직접 한다(인덱스 "주인님이 직접 할 일").

---

### Task K0-6: 전체 검증과 커밋

- [ ] **Step 1: 타입, 린트, 테스트**

Run: `npx tsc --noEmit; npm run lint; npm test`
Expected: 오류 0, 테스트 전부 PASS(기존 + `formatVisitMeta` 3건).

- [ ] **Step 2: 커밋** (계획 디렉터리와 에이전트 정의 3개를 함께 넣는다)

```bash
git add src/actions/records-types.ts src/types/kakao-maps.d.ts src/app/globals.css src/lib/format.ts tests/lib/format.test.ts .env.example docs/superpowers/plans/2026-09-04-personal-map .claude/agents/map-k1-server.md .claude/agents/map-k2-client.md .claude/agents/map-k3-integration.md
git commit -m "feat(map): 퍼스널 맵 기반 - 공용 타입, 카카오 SDK 타입 선언, CSS 클래스, formatVisitMeta (스펙 16)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D9kAoPJFsiCpzGBkUqNKkH"
```

- [ ] **Step 3: 커밋 해시를 기록한다.** K1, K2 에이전트 프롬프트에 넣는다.
