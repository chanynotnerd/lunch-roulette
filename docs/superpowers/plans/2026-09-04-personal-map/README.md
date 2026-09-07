# 퍼스널 맵(기록 탭 카카오 지도) 구현 계획 (인덱스)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기록 탭을 전체 화면 카카오 지도로 바꾸고, 확정한 식당마다 방문 횟수와 레벨이 드러나는 도장 마커를 찍는다. 날짜별 기록 목록은 플로팅 버튼으로 여는 오버레이로 옮긴다.

**Architecture:** 서버 액션 하나(`loadRecordsScreen`)가 confirmed 세션을 한 번 조회해 기록 목록과 식당별 마커를 만든다. 클라이언트 컴포넌트 `RecordsScreen`이 상태 두 개(선택 식당, 목록 열림)를 갖고 `KakaoMap`(SDK 로드와 마커), `MarkerCard`(식권 카드), `RecordsList`(목록 오버레이)를 조립한다. 카카오 객체는 `KakaoMap` 안에만 있고, 계산은 전부 순수 함수로 빼서 Vitest로 검증한다. 기반(K0)을 먼저 커밋한 뒤 서버(K1)와 클라이언트(K2)를 서브에이전트 2개가 동시에 작업하고, 통합(K3)이 페이지를 연결한다.

**Tech Stack:** Next.js 16 App Router, React 19, 카카오맵 JavaScript SDK(래퍼 라이브러리 없음, `next/script`로 로드), 순수 CSS(`globals.css` 한 곳), Vitest. 새 npm 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-04-lunch-roulette/16-personal-map.md`. 시각 언어는 `15-visual-design.md`, 데이터는 `04-data-model.md`, 오류 규약은 `08-errors.md`, 테스트 계층은 `11-testing.md`.

## Global Constraints

- 결정 M1~M7(스펙 16)은 다시 논의하지 않는다. 마커 = 식당, 전체 화면 지도, 식권 카드, 자동 맞춤, 도장 마커, SDK 직접 사용, 플로팅 버튼 오른쪽 위 고정.
- 새 npm 의존성을 추가하지 않는다. 카카오 타입 패키지도 깔지 않고 `src/types/kakao-maps.d.ts`에 쓰는 것만 선언한다. (스펙 16 M6)
- DB 쿼리 추가, 마이그레이션 없음. `restaurants.lat/lng`와 confirmed 세션만 쓴다. (스펙 16 데이터)
- 토큰: paper #FFFFFF, ink #000000, seal #D62E2E, seal-deep #B3201F, muted #6F6F6F, rule #E3E3E3. `globals.css`의 CSS 변수(`--paper`, `--ink`, `--seal`, `--seal-deep`, `--muted`, `--rule`, `--tabbar-h`)만 쓴다. (스펙 15)
- 지도 위 요소(플로팅 버튼, 카드, 안내 상자)는 흰 바탕에 검은 테두리 2겹. 그림자와 빨간 버튼 금지. (스펙 16 시각 디자인 2)
- 도장 마커 지름은 레벨 1~5에 32, 36, 40, 44, 48px. 레벨 4부터 테두리 seal-deep 3px. 선택 시 흰 띠 3px + 검은 고리 2px. (스펙 16 시각 디자인 3)
- 문구는 스펙 16 "문구" 표의 여섯 개와 07, 08, 15의 기존 문구만. 가운뎃점(·) 금지, 쉼표 연결. (스펙 15, 16)
- 인라인 `style={{…}}` 금지. 클래스는 K0가 `globals.css`에 정의한 것만 쓴다. 클래스가 부족하면 만들지 말고 보고서에 적는다. K3가 넣는다.
- 움직임 없음. 마커, 카드, 오버레이는 즉시 나타나고 사라진다. (스펙 16 동작)
- Result 코드를 늘리지 않는다. 지도 실패는 브라우저 상태이며 `console.error`만 남긴다. (스펙 16 오류)
- 서버 액션은 `requireUser` → `AUTH_REQUIRED`, `try/catch` → `UNEXPECTED` 규약 그대로. (스펙 08)
- 커밋할 때 `git add`는 자기 세션이 소유한 파일만 명시한다. `git add -A`, `git add .` 금지. 커밋 메시지는 한국어이며 아래 트레일러를 붙인다.

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D9kAoPJFsiCpzGBkUqNKkH
```

- 검증 명령: 타입 `npx tsc --noEmit`, 린트 `npm run lint`, 테스트 `npm test`(Vitest, `tests/**/*.test.ts`). 기존 테스트 전부 통과가 전제다.

---

## 세션 구성과 의존 관계

| 세션 | 파일 | 담당 | 선행 | 예상 시간 |
|---|---|---|---|---|
| K0 | [K0-foundation.md](K0-foundation.md) | 공용 타입, 카카오 타입 선언, CSS 클래스, `formatVisitMeta`(TDD), 환경변수 예시 | 없음. **main에서 가장 먼저 단독 실행 후 커밋** | 15분 |
| K1 | [K1-server.md](K1-server.md) | 순수 함수 `toRecordRows`, `toMarkers`(TDD), 서버 액션 `loadRecordsScreen`(모의 클라이언트 테스트) | K0 커밋 | 25분 |
| K2 | [K2-client.md](K2-client.md) | `initialView`, `stampMarkerHtml`(TDD), `KakaoMap`, `MarkerCard`, `RecordsList`, `RecordsScreen` | K0 커밋 | 35분 |
| K3 | [K3-integration.md](K3-integration.md) | 기록 페이지 연결, `listRecords` 제거, 빌드, 실제 키로 화면 확인, 스펙 07/13/14/15/16과 인수인계 갱신 | K1, K2 완료 + 카카오 JavaScript 키 | 30분 |

실행 순서:

1. main에서 K0를 실행하고 커밋한다. 이 시점에 화면은 바뀌지 않는다(타입, CSS, 유틸만 추가).
2. K1, K2를 서브에이전트 2개로 **같은 작업 트리에서** 동시에 실행한다. 파일 소유권이 겹치지 않고, K2가 K1의 코드를 import하지 않으므로 충돌이 없다. 각 세션은 자기 파일만 `git add`해서 커밋한다. 커밋 순서는 상관없다.
3. 두 세션의 보고서를 받은 뒤 K3를 실행한다. K3는 실제 카카오 JavaScript 키가 `.env.local`에 있어야 화면을 확인할 수 있다(아래 "주인님이 직접 할 일").

병렬 단계 규칙(K1, K2 공통):

- `src/app/globals.css`, `src/actions/records-types.ts`, `src/types/kakao-maps.d.ts`, `src/lib/format.ts`는 **읽기 전용**이다. 부족한 클래스나 타입은 보고서 "부족한 것" 항목에 이름과 원하는 내용을 적는다.
- K1은 `src/app/(app)/records/` 아래를 쓰지 않는다. K2는 `src/actions/` 아래를 쓰지 않는다.
- `src/app/(app)/records/page.tsx`는 K3 전까지 아무도 건드리지 않는다. K2가 만든 컴포넌트는 K3 전까지 화면에 연결되지 않는다. K2는 타입 검사와 단위 테스트로만 검증한다.
- 타입 검사와 린트는 다른 세션의 작업 중 파일 때문에 잠깐 실패할 수 있다. 자기 파일에서 난 오류만 고치고, 남의 파일 오류는 보고서에 적는다.
- 보고서 형식: 바꾼 파일, 커밋 해시, 테스트 결과(명령 출력 그대로), 부족한 것(클래스, 타입, 문구), 남의 파일에서 본 오류, 스펙과 다르게 한 것과 이유.

## 파일 소유권 (세션 간 충돌 방지)

| 경로 | 소유 세션 |
|---|---|
| `src/actions/records-types.ts`, `src/types/kakao-maps.d.ts`, `src/app/globals.css`, `src/lib/format.ts`, `tests/lib/format.test.ts`, `.env.example` | K0 (병렬 단계에서는 K3만 수정 가능) |
| `src/actions/records-helpers.ts`, `src/actions/records.ts`, `tests/actions/records-helpers.test.ts`, `tests/actions/records.test.ts` | K1 |
| `src/app/(app)/records/initial-view.ts`, `stamp-marker.ts`, `KakaoMap.tsx`, `MarkerCard.tsx`, `RecordsList.tsx`, `RecordsScreen.tsx`, `tests/app/initial-view.test.ts`, `tests/app/stamp-marker.test.ts` | K2 |
| `src/app/(app)/records/page.tsx`, `src/actions/records.ts`(`listRecords` 제거만), `docs/superpowers/specs/2026-09-04-lunch-roulette/07-screens.md`, `13-backlog.md`, `14-userflow-happy-case.md`, `15-visual-design.md`, `16-personal-map.md`, `docs/superpowers/handoff/2026-09-04-session-handoff.md` | K3 |

## 주인님이 직접 할 일 (K3 전까지)

코드 밖 작업이며 비밀 값은 채팅에 적지 않는다.

1. 카카오 개발자 콘솔의 앱 "점심 룰렛"(ID 1567010)에서 **JavaScript 키**를 확인한다. REST API 키와 다른 값이다.
2. 앱 설정 → 플랫폼 → Web → 사이트 도메인에 `http://localhost:3000`과 `https://lunch-roulette-sooty.vercel.app`을 등록한다.
3. 앱 설정 → 제품 설정 → 카카오맵이 활성화돼 있는지 확인한다(인수인계 문서상 이미 ON).
4. `.env.local`에 `NEXT_PUBLIC_KAKAO_JS_KEY=<JavaScript 키>`를 넣고 dev 서버를 재시작한다. Vercel 환경변수에도 같은 이름으로 넣는다(배포는 이 계획 밖).

## 서브에이전트 정의

`.claude/agents/`에 아래 3개를 둔다. 이름이 진행 상황 표시에 그대로 나온다.

| 파일 | 이름 | 세션 |
|---|---|---|
| `map-k1-server.md` | 맵 K1 서버 | K1 |
| `map-k2-client.md` | 맵 K2 클라이언트 | K2 |
| `map-k3-integration.md` | 맵 K3 통합 | K3 |

각 에이전트에는 해당 세션 파일 경로와 "파일 소유권 표 밖의 파일은 쓰지 않는다"를 프롬프트에 넣는다. 5분마다 진행 상황을 주인님께 보고한다.

## 화면 확인에 필요한 것

- `npm run dev` → http://localhost:3000. 로그인은 주인님 Google 계정(boltwriter721)으로 Chrome에서 직접.
- 기록이 있는 계정이어야 마커가 보인다. 기록이 없으면 `.env.local`의 `ROULETTE_ALLOW_ANY_TIME=true` 상태에서 홈에서 돌리기 → 확정으로 하나 만든다.
- 에이전트는 장소 삭제, 장소 추가(외부 API 호출), 관리자 초기화, 공용 dev 서버 로그아웃을 하지 않는다.

## 배포

이 계획 밖이다. 주인님이 지시하면 Vercel 환경변수 `NEXT_PUBLIC_KAKAO_JS_KEY` 확인 후 `npx vercel --prod --yes`.
