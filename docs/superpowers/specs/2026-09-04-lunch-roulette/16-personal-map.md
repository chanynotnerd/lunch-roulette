# 16. 퍼스널 맵 (기록 탭 지도)

[← 인덱스](README.md)

기록 탭을 전체 화면 카카오 지도로 바꾼다. 확정한 식당마다 도장 마커 하나를 찍고, 마커에 방문 횟수와 레벨을 드러낸다.
날짜별 기록 목록은 플로팅 버튼으로 여는 오버레이로 옮긴다. 홈과 장소 화면, 서버 규칙, 데이터베이스는 바꾸지 않는다.

## 선행 조건과 순서

- 스펙 15 시각 디자인 계획(U0 → A, B, C → D)이 커밋된 뒤에 구현한다. 이 스펙은 U0가 정의하는 CSS 토큰, `--tabbar-h`, `stub`/`stubs` 클래스, `LevelStamps` 컴포넌트와 세션 C가 만드는 `formatSlotDate`, 기록 목록 JSX에 기댄다.
- 구현 계획은 이 스펙을 읽고 따로 쓴다. 이 스펙은 무엇을 만드는지만 정한다.

## 결정 (2026-09-04 브레인스토밍)

| 번호 | 결정 | 이유 |
|---|---|---|
| M1 | 마커 하나 = 식당 하나. 같은 식당을 여러 번 가도 마커는 하나이고, 방문 횟수와 레벨을 마커에 얹는다 | 기록 하나당 마커를 찍으면 같은 자리에 겹쳐 의미가 흐려진다. "내 단골 지도"가 목적이다 |
| M2 | 기록 탭 전체가 지도. 자유롭게 이동, 확대. 날짜별 목록은 플로팅 버튼으로 여는 오버레이 | 지도를 크게 쓰면서 기존 목록도 잃지 않는다 |
| M3 | 마커 탭 시 지도 아래에 식권 카드 하나. 이름, 주소, 도장 5칸, 방문 횟수, 마지막 방문일 | 스펙 15의 식권을 재사용한다. 방문 날짜 목록까지 넣으면 지도가 가려진다 |
| M4 | 처음 열면 마커가 모두 들어오게 자동 맞춤. 기록이 없으면 첫 장소 좌표, 장소도 없으면 서울시청 | 장소 선택기 없이 한 화면으로 시작한다. 회사와 집이 멀어 불편해지면 장소 선택기를 나중에 붙인다 |
| M5 | 도장 모양 마커. 빨간 원 안에 방문 횟수 숫자, 레벨이 오를수록 커지고 테두리가 진해짐. 이름은 마커에 쓰지 않는다 | 스펙 15의 확정 도장과 같은 그림이라 지도가 곧 도장판이 된다. 이름 라벨은 마커가 몰리면 겹친다 |
| M6 | 카카오맵 JavaScript SDK를 래퍼 라이브러리 없이 직접 쓴다 | 의존성을 늘리지 않는다. 마커를 도장 HTML로 그리는 데 제약이 없다. 정적 지도 이미지는 이동이 안 돼 제외 |
| M7 | 플로팅 버튼은 항상 오른쪽 위에 고정 | 아래에 두면 카드와 겹친다. 자리가 고정돼야 상태가 바뀌어도 버튼을 찾기 쉽다 |
| M8 (2026-09-07 추가) | 사용자의 장소(회사, 집)를 검은 점 + 이름 라벨 마커로 지도에 표시한다. 누를 수 없고 탭은 지도로 통과한다. 초기 자동 맞춤에는 넣지 않는다 | 기준점이 어딘지 보여야 도장의 위치가 읽힌다. 카드까지 만들면 도장 마커의 카드와 경쟁하고, 장소 정보는 장소 탭에 이미 있다. 범위에 넣으면 회사와 집이 멀 때 도장이 점처럼 작아진다(B8 영역) |

## 시각 디자인 (스펙 15 개정 항목)

스펙 15의 컨셉, 토큰, 서체, 문구 규칙을 그대로 쓴다. 아래 네 가지는 15에 없던 규칙이며, 이 스펙이 15를 보충한다.

1. **레이아웃 예외.** 15의 "한 열, 최대 480px, 좌우 여백 20px"에서 기록 화면만 벗어난다. 지도는 `position: fixed`로 화면 위쪽부터 하단 탭 위(`bottom: var(--tabbar-h)`)까지 채운다. `(app)` 레이아웃 파일은 손대지 않는다.
2. **지도 위 요소의 구분법.** 15는 카드 그림자를 금지하고 빨간 버튼을 홈의 돌리기 하나로 제한한다. 지도 위에 뜨는 플로팅 버튼, 식권 카드, 안내 상자는 흰 바탕(paper)에 검은(ink) 테두리 2겹으로 지도와 구분한다. 메뉴판과 같은 어휘다. 그림자와 빨간 버튼은 쓰지 않는다.
3. **도장 마커.** seal 색 원 안에 흰 숫자(Black Han Sans). 레벨 1~5의 지름은 32, 36, 40, 44, 48px. 레벨 4부터 테두리를 seal-deep 3px로 진하게 한다. 선택된 마커는 흰 띠 3px 위에 검은 고리 2px가 더 생긴다. 움직임은 없다.
4. **문구 추가.** 아래 "문구" 절의 여섯 개를 15의 문구 표에 더한다.

지도 타일은 카카오 기본 스타일 그대로 둔다. 흑백 필터는 마커까지 바래게 하므로 쓰지 않는다.

## 데이터

DB 쿼리와 마이그레이션은 추가하지 않는다. `restaurants`에 카카오 검색 때 저장한 `lat`, `lng`가 이미 있고, 기록은 confirmed 세션이 `chosen_restaurant_id`로 그 식당을 가리킨다. [04-data-model.md](04-data-model.md)

### 서버 액션

기존 `listRecords`를 `loadRecordsScreen`으로 바꾼다. 소비처는 기록 페이지 하나다. 조회는 한 번이고 결과를 두 모양으로 가공한다.

- 조회: 본인의 confirmed 세션을 `slot_date desc, slot desc`로. select에 `restaurants(id, name, address, lat, lng)`를 넣는다(기존은 `name`만).
- 반환: `{ records: RecordRow[], markers: MapMarker[], places: PlaceMarker[], fallbackCenter: LatLng }`.
- `places`: 사용자의 장소 전부(`places`를 `created_at asc`로, `id, name, lat, lng`). 좌표가 유한하지 않은 행은 뺀다(`toPlaceMarkers`). 최대 10개.
- 로그인 안 됨 → `AUTH_REQUIRED`. 조회 실패 → `UNEXPECTED`. 스펙 08의 Result 규약 그대로.
- `fallbackCenter`: `places`의 첫 항목 좌표. 없으면 서울시청 `{ lat: 37.5665, lng: 126.9780 }` 상수.

### 타입

```ts
type RecordRow = {
  slotDate: string; slot: Slot; slotLabel: string; placeName: string
  restaurantId: string          // 추가. 목록 항목 탭 → 마커 선택에 쓴다
  restaurantName: string; levelAtThatTime: number; levelName: string
}

type MapMarker = {
  restaurantId: string; name: string; address: string
  lat: number; lng: number
  visits: number                // 그 식당의 confirmed 행 수 = 경험치
  level: number; levelName: string   // getLevel(visits). 스펙 05 레벨 표
  lastVisitDate: string         // 마지막 confirmed 행의 slot_date (YYYY-MM-DD)
}

type PlaceMarker = { id: string; name: string; lat: number; lng: number }   // M8. 장소 마커
```

### 순수 함수 (`src/actions/records-helpers.ts`)

- `toMarkers(rows)`: 조회 행 → `MapMarker[]`. 식당별로 묶고, `lat` 또는 `lng`가 숫자가 아닌 행은 제외한다. 현재 스키마에서는 생기지 않지만 방어한다. 정렬은 방문 횟수 내림차순.
- `initialView(markers, fallbackCenter)`(구현은 `src/app/(app)/records/initial-view.ts`. 클라이언트에서만 쓰므로 K2가 서버 헬퍼 대신 기록 화면 폴더에 두었다): 마커 0개면 `{ kind: 'center', center: fallbackCenter, zoom: 5 }`, 1개면 `{ kind: 'center', center: 그 마커, zoom: 4 }`, 2개 이상이면 `{ kind: 'bounds', points: 마커 좌표들 }`. 카카오 확대 단계는 숫자가 작을수록 가깝다(4 ≈ 100m 축척).
- 기록 목록 가공(`toRecordRows`)은 지금 `listRecords` 안의 반복문을 그대로 옮긴 것이다. `levelAtTime` 계산은 바뀌지 않는다.
- `toPlaceMarkers(rows)`: 장소 행 → `PlaceMarker[]`. 좌표가 유한한 숫자가 아닌 장소는 뺀다. 입력 순서(생성순)를 지킨다.

### 페이지가 클라이언트에 넘기는 것

기록 페이지(서버 컴포넌트)가 `loadRecordsScreen` 결과와 `NEXT_PUBLIC_KAKAO_JS_KEY`, 관리자 초기화 버튼 요소를 `RecordsScreen`에 props로 넘긴다. 브라우저에서 Supabase를 직접 부르지 않는다. [03-architecture.md](03-architecture.md)

## 화면 구성

```
┌──────────────────────────┐
│ 지도 (전체 화면)    ┌────┐│
│                     │ ≡  ││  플로팅 버튼. 오른쪽 위 고정. 흰 바탕, 검은 테두리 2겹
│      (3)        (1) └────┘│
│  (5)                     │  도장 마커. 숫자는 방문 횟수, 크기는 레벨
│                          │
│ ┌──────────────┬──────┐ │
│ │ 김밥천국      ┆ ●●●○○│ │  식권 카드. 마커 탭 시만. 하단 탭 위 16px
│ │ 강남대로 123  ┆ 집밥 │ │
│ │ 7회 방문, 마지막 방문 9월 4일│
│ └──────────────┴──────┘ │
│  홈  장소  기록  내 정보 │  하단 탭 4칸(스펙 18)
└──────────────────────────┘
```

플로팅 버튼을 누르면 흰 바탕 오버레이가 지도를 완전히 덮고 "기록" 제목, 관리자 초기화 버튼(관리자만), 날짜별 목록(세션 C의 식권 더미 그대로)이 나온다. 같은 자리의 버튼이 닫기(X)로 바뀐다.

### 컴포넌트

| 파일 | 종류 | 책임 |
|---|---|---|
| `src/app/(app)/records/page.tsx` | 서버 | `loadRecordsScreen` 호출, `AUTH_REQUIRED`면 `/login`으로, 실패면 오류 문구, 성공이면 `RecordsScreen` |
| `src/app/(app)/records/RecordsScreen.tsx` | 클라이언트 | 상태 두 개: 선택된 식당 id, 목록 열림 여부. 아래 넷을 조립 |
| `src/app/(app)/records/KakaoMap.tsx` | 클라이언트 | SDK 로드, 지도 생성, 초기 범위, 마커 그리기와 갱신. props: jsKey, markers, selectedId, initialView, panTarget, onSelect(id), onDeselect(). 키 없음, 스크립트 onError, 10초 타임아웃은 이 컴포넌트 안에서 `map-fail` 상자로 그린다(onFail 콜백 없음). 카카오 객체는 이 파일 밖으로 나가지 않는다 |
| `src/app/(app)/records/initial-view.ts` | 순수 함수 | `initialView(markers, fallbackCenter)` → `InitialView`. 클라이언트에서만 쓰므로 여기에 둔다 |
| `src/app/(app)/records/MarkerCard.tsx` | 클라이언트 | 선택된 마커의 식권 카드. `LevelStamps compact` 사용 |
| `src/app/(app)/records/RecordsList.tsx` | 클라이언트 | 세션 C가 만든 목록 JSX를 옮긴 것. 항목 탭 시 `onPick(restaurantId)` |
| `src/app/(app)/records/stamp-marker.ts` | 순수 함수 | `stampMarkerHtml({ visits, level, name, levelName, selected })`와 `placeMarkerHtml({ name })` → CustomOverlay content 문자열 |
| `src/types/kakao-maps.d.ts` | 타입 선언 | `window.kakao.maps` 중 쓰는 것만: `load`, `Map`, `LatLng`, `LatLngBounds`, `CustomOverlay`, `event.addListener`. 타입 패키지는 깔지 않는다 |

CSS 클래스는 `globals.css`에 추가한다. 이름은 `map-screen`, `map-fab`, `map-ticket`, `map-notice`, `map-sheet`, `stamp-marker`(+ `l1`~`l5`, `selected`), `place-marker`(+ `place-marker-dot`, `place-marker-name`). 인라인 스타일은 쓰지 않는다.

### 동작

- **초기 화면.** `initialView` 결과대로. `bounds`면 `setBounds`에 여백 48px을 준다. 마커가 하나면 그 지점 중심 확대 4. 없으면 `fallbackCenter` 중심 확대 5에 안내 상자를 지도 위쪽에 띄운다.
- **마커.** 각 마커는 CustomOverlay 하나. content는 `<button>`이고 탭 시 `onSelect`. 마커 탭이 지도 빈 곳 탭으로 이중 처리되지 않게 이벤트 전파를 막는다. 겹침 순서(zIndex)는 선택된 것이 가장 위, 그다음은 레벨이 낮을수록 위. 큰 도장이 작은 도장을 덮지 않게 하기 위해서다.
- **선택.** 마커 탭 → 그 식당 선택, 카드 표시. 다른 마커 탭 → 교체. 지도 빈 곳 탭 또는 Esc → 해제. 카드에 닫기 버튼은 두지 않는다. 선택해도 지도는 움직이지 않는다.
- **목록.** 플로팅 버튼 → 오버레이 열림, 버튼이 X로. X 또는 Esc → 닫힘. 오버레이가 열려 있어도 지도 인스턴스는 유지되며 닫으면 보던 위치 그대로다. 목록 항목 탭 → 오버레이 닫고 그 식당을 선택하며 지도 중심을 그 마커로 옮긴다(`panTo`).
- **장소 마커(M8).** `places`마다 CustomOverlay 하나. content는 검은 점(ink 10px) + 흰 바탕 검은 테두리의 이름 라벨. 점이 좌표에 오고 라벨은 오른쪽으로 뻗는다(xAnchor 0, yAnchor 0.5). `clickable: false`와 `pointer-events: none`으로 탭이 지도로 통과하므로 카드 닫기를 방해하지 않는다. zIndex는 도장 마커보다 아래(0). 지도가 준비될 때 한 번 그린다.
- **SDK 컨트롤.** 카카오 기본 확대 컨트롤과 지도 유형 컨트롤은 넣지 않는다. 핀치와 더블탭으로 확대한다. 플로팅 버튼 자리를 비워 두기 위해서다.
- **움직임.** 없다. `prefers-reduced-motion`과 무관하게 마커, 카드, 오버레이 모두 즉시 나타나고 사라진다. `panTo`는 SDK 기본 이동을 쓴다.

### 접근성

- 지도는 키보드로 쓰기 어렵다. 목록 오버레이가 대체 경로다. 키보드만으로 플로팅 버튼 → 목록 → 항목 → 닫기가 가능해야 한다.
- 지도 컨테이너: `role="region"`, `aria-label="다녀온 식당 지도"`.
- 마커 버튼: `aria-label="{식당명}, 레벨 {N} {이름}, {N}회 방문"`, 선택 시 `aria-pressed="true"`.
- 플로팅 버튼: `aria-label`은 닫힘 상태 "기록 목록 보기", 열림 상태 "지도로 돌아가기". `aria-expanded`.
- 오버레이: `role="dialog"`, `aria-labelledby`는 "기록" 제목. 플로팅 버튼이 닫기 역할이라 `aria-modal`은 두지 않는다. 열릴 때 제목으로 포커스, 닫힐 때 플로팅 버튼으로 복귀.
- 카드: `role="status"`로 선택 변경을 알린다. 도장 5칸은 `LevelStamps`의 라벨 그대로.
- 포커스 링은 15와 같이 seal 3px.

## 카카오 설정

코드 밖에서 할 일이다. 구현 계획의 첫 작업으로 둔다.

1. 지금 쓰는 카카오 앱(REST API 키와 같은 앱)에서 **JavaScript 키**를 확인한다. 새 앱을 만들지 않는다.
2. 앱 설정 → 플랫폼 → Web에 사이트 도메인을 등록한다. `http://localhost:3000`과 Vercel 배포 주소.
3. 앱 설정 → 제품 설정 → 카카오맵을 활성화한다. 2와 3 중 하나라도 빠지면 SDK가 조용히 실패한다.
4. `NEXT_PUBLIC_KAKAO_JS_KEY`를 `.env.example`(빈 값), `.env.local`, Vercel 환경변수에 넣는다. 브라우저에 노출되는 키지만 도메인 제한이 걸려 있어 카카오가 의도한 사용법이다. 스펙 09의 REST 키 안전장치와는 별개다.

### SDK 로드

- `KakaoMap`이 `next/script`(`strategy="afterInteractive"`)로 `https://dapi.kakao.com/v2/maps/sdk.js?appkey={키}&autoload=false`를 넣는다.
- 스크립트 `onLoad`에서 `window.kakao.maps.load(콜백)`을 부르고, 콜백 안에서 지도를 만든다. 이 순서를 지켜야 `kakao is not defined`가 나지 않는다.
- 지도 컨테이너는 서버 렌더링에서 회색 자리 표시자만 나간다. 지도 생성은 브라우저에서만.
- 같은 탭에서 기록 화면을 다시 열어도 스크립트를 두 번 넣지 않는다(`window.kakao?.maps`가 있으면 바로 `load`).

## 오류와 상태

지도 실패는 서버 액션 오류가 아니라 브라우저 상태다. 스펙 08의 Result 코드를 늘리지 않고 `console.error`에 원인만 남긴다.

| 상황 | 화면 |
|---|---|
| SDK 로드 전 | 지도 자리에 회색 바탕, 가운데 "지도를 불러오는 중" |
| 키 없음(`NEXT_PUBLIC_KAKAO_JS_KEY` 빈 값), 스크립트 `onError`, `load` 후 10초 안에 지도 생성 안 됨 | 지도 자리에 흰 상자(테두리 2겹) "지도를 표시할 수 없습니다. 목록으로 볼 수 있습니다". 플로팅 버튼과 목록은 그대로 동작 |
| `loadRecordsScreen` 실패 | 지금처럼 스펙 08 문구만. 지도도 목록도 없음 |
| `AUTH_REQUIRED` | `/login`으로 |
| 기록 없음 | `fallbackCenter` 중심 지도 위쪽에 흰 상자 "아직 기록이 없습니다. 홈에서 룰렛을 돌리면 여기에 쌓입니다"(15 문구). 목록 오버레이도 같은 문구 |
| 장소 삭제됨 | 목록의 장소 이름이 "삭제된 장소"(07). 마커는 식당 기준이라 영향 없음 |
| 좌표 없는 식당 | `toMarkers`가 제외. 목록에는 남는다 |

## 문구

15의 문구 표에 아래 여섯 개를 더한다. 그 밖의 문구는 07, 08, 15 그대로다.

| 위치 | 문구 |
|---|---|
| 지도 로드 중 | 지도를 불러오는 중 |
| 지도 실패 | 지도를 표시할 수 없습니다. 목록으로 볼 수 있습니다 |
| 카드 방문 정보 | {N}회 방문, 마지막 방문 {M}월 {D}일 |
| 플로팅 버튼 라벨 | 기록 목록 보기 / 지도로 돌아가기 |
| 마커 라벨 | {식당명}, 레벨 {N} {레벨 이름}, {N}회 방문 |
| 지도 영역 라벨 | 다녀온 식당 지도 |
| 장소 마커 라벨 | 장소 {장소 이름} |

"마지막 방문 {M}월 {D}일"은 연도를 뺀다. 카드가 좁고, 연도가 필요한 정보는 목록에 있다. 형식 함수는 `src/lib/format.ts`에 `formatVisitMeta(visits, isoDate)`로 둔다.

## 테스트

스펙 11의 세 계층을 따른다.

### 계층 1. 순수 함수 (Vitest)

| 대상 | 반드시 포함할 케이스 |
|---|---|
| `toMarkers` | 같은 식당 3행 → 마커 1개, visits 3, lastVisitDate는 가장 늦은 날짜. 식당 둘 → 마커 2개, 방문 횟수 내림차순. level과 levelName이 `getLevel(visits)`와 같음. lat이 null인 행 제외. 빈 입력 → 빈 배열 |
| `initialView` | 0개 → center fallback zoom 5. 1개 → center 그 마커 zoom 4. 2개 이상 → bounds에 좌표 전부 |
| `stampMarkerHtml` | 레벨 1~5 각각 `l1`~`l5` 클래스. 숫자가 visits. aria-label 형식. selected면 `selected` 클래스, 아니면 없음. 식당명에 `<`가 있어도 HTML로 해석되지 않음(이스케이프) |
| `formatVisitMeta` | (7, '2026-09-04') → "7회 방문, 마지막 방문 9월 4일". 앞 0 제거. 형식 이상이면 날짜 부분에 입력 그대로 |
| `toPlaceMarkers` | id, 이름, 좌표만 남기고 순서 유지. lat null 또는 NaN인 장소 제외. 빈 입력 → 빈 배열 |
| `placeMarkerHtml` | `place-marker` div에 점과 이름 span, `role="img"`, aria-label "장소 {이름}". 이름 이스케이프 |

### 계층 2. 서버 액션 (모의 클라이언트)

`tests/actions/roulette.test.ts`의 방식으로 Supabase 클라이언트를 가짜로 바꿔 검증한다.

- 로그인 안 됨 → `AUTH_REQUIRED`.
- confirmed 행 3개(식당 둘) → `records` 3개, `markers` 2개, 두 결과의 `restaurantId`가 서로 연결됨.
- select 문자열에 `lat`, `lng`, `restaurants(id`가 포함됨(빠뜨리면 마커가 0개가 되는 회귀 방지).
- 장소 전체가 생성순으로 `places`에 내려오고 select에 `id, name, lat, lng`. `fallbackCenter`는 첫 장소 좌표. 장소 0건 → `places` 빈 배열, `fallbackCenter`는 서울시청 상수.
- 조회 오류 → `UNEXPECTED`.

### 계층 3. 화면 (수동, 390px)

실제 카카오 키로 브라우저에서 본다. `KakaoMap`은 SDK 없이 돌릴 수 없어 자동 테스트를 만들지 않는다. 대신 그 파일을 얇게 유지한다.

- 마커가 전부 보이게 열리고, 이동과 확대가 된다.
- 마커 탭 → 카드, 빈 곳 탭 → 닫힘, 다른 마커 탭 → 교체. 플로팅 버튼이 카드를 가리지 않는다.
- 플로팅 버튼 → 목록, X와 Esc → 닫힘, 항목 탭 → 지도로 돌아가 그 마커 선택과 이동.
- 기록 없는 계정: 안내 상자와 기본 중심.
- 키를 일부러 틀리게 넣고: 실패 상자가 뜨고 목록은 동작한다.
- 키보드만으로 플로팅 버튼과 목록을 오갈 수 있다.

#### 확인 결과 (2026-09-07, 계획 K3-3)

localhost:3000, Chrome, 지도 폭 480px 가운데 정렬, 실제 카카오 JavaScript 키, 기록 1건인 관리자 계정으로 확인했다.

| 번호 | 확인 | 결과 |
|---|---|---|
| 1 | 진입 | 확인. 마커 1개라 그 지점 중심 확대 4. 오른쪽 위 플로팅 버튼(흰 바탕, 검은 테두리 2겹) |
| 2 | 드래그, 확대 | 확인. 드래그로 이동, 휠로 확대(축척 100m → 50m) |
| 3 | 마커 탭 | 확인. 검은 고리, 하단 식권 카드(이름, 주소, "1회 방문, 마지막 방문 9월 4일", 도장 5칸 중 2개와 "익숙"). 플로팅 버튼과 겹치지 않음 |
| 4 | 다른 마커 탭 | 미확인. 계정에 마커가 1개뿐 |
| 5 | 지도 빈 곳 탭 | 확인. 카드 닫힘 |
| 6 | 플로팅 버튼 | 확인. 흰 오버레이, "기록" 제목, 관리자 초기화 버튼, 식권 더미 목록 1건, 버튼이 X로 바뀜 |
| 7 | 목록 항목 탭 | 확인. 오버레이 닫히고 마커 선택(고리)과 카드 표시, 지도가 마커로 이동(드래그 후 재확인) |
| 8 | X, Esc | 확인. Esc로 목록 닫힘, Esc로 카드 닫힘. 닫힌 뒤 플로팅 버튼에 포커스 링 |
| 9 | 키보드만 | 확인. 플로팅 버튼 → Enter → 목록 → Tab 2번으로 항목(빨간 포커스 링) → Enter → 지도 복귀, 마커 선택, 포커스는 플로팅 버튼 |
| 10 | 기록 없는 계정 | 미확인. 다른 계정이 없음 |
| 11 | 틀린 키 | 확인. 회색 바탕 위에 "지도를 표시할 수 없습니다. 목록으로 볼 수 있습니다" 상자, 플로팅 버튼과 목록 정상 동작. 콘솔에 "[KakaoMap] SDK 스크립트 로드 실패"와 10초 뒤 "[KakaoMap] 지도 초기화 시간 초과"(React StrictMode 이중 마운트로 각 2회). 키 원복 후 지도가 다시 뜨는 것까지 확인 |
| 12 | 데스크톱 폭 | 확인. 지도와 하단 탭이 같은 480px 폭으로 가운데 정렬 |

정상 키에서는 콘솔 오류 없음. SDK 컨트롤(확대, 지도 유형)은 코드에 `addControl`이 없어 넣지 않았다.

2026-09-07 M8 장소 마커 확인(로컬): 장소 "회사"가 검은 점과 라벨로 도장 마커 아래에 보임. 카드가 뜬 상태에서 라벨을 누르면 탭이 지도로 통과해 카드가 닫힘. 스크린샷 `06-place-marker.jpg`.
스크린샷: `docs/superpowers/reviews/2026-09-04-personal-map/01-map.jpg`, `02-marker-card.jpg`, `03-list.jpg`, `05-failed.jpg`. `04-empty`는 항목 10을 확인하지 못해 없다.

## 이 스펙이 바꾸는 다른 문서

구현이 끝나면 아래를 갱신한다.

- [07-screens.md](07-screens.md) S4: "날짜 내림차순 목록"을 "전체 화면 지도 + 목록 오버레이"로. 세부는 이 문서 링크.
- [13-backlog.md](13-backlog.md): 장소 선택기(M4의 후속), 마커 클러스터링을 새 항목으로 추가.
- [14-userflow-happy-case.md](14-userflow-happy-case.md): 기록 확인 단계에 지도와 마커 탭을 추가.
- [15-visual-design.md](15-visual-design.md): "시각 디자인" 절의 네 가지를 15 본문에 반영하거나 이 문서 링크로 대체.
- 인수인계 문서: 카카오 JavaScript 키 발급과 도메인 등록 사실.

## 제외

- 장소 선택기(회사/집 중심 전환). M4의 후속. 백로그.
- 마커 클러스터링. 한 사용자의 식당 수가 수십 개 수준이라 아직 필요 없다. 백로그.
- 아직 안 가 본 후보 식당 표시("동네 정복도"). 화면이 복잡해진다.
- 지도 흑백 필터, 길찾기 연결, 마커 애니메이션, 현재 위치 표시.
- 지도 위치와 확대 단계 기억(다시 열면 항상 초기 화면).
