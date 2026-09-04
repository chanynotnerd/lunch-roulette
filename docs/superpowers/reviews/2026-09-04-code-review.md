# 코드리뷰 통합 보고서 (2026-09-04)

대상: main 전체 (6dec7ed 스캐폴드 → 9970bcb), src 약 2,185줄, 커밋 35개.
방법: 자동 검증 → 영역별 리뷰어 3명(규칙 엔진 / 서버 액션·데이터·인증 / 화면·외부 API) → 보안 전담 리뷰어 1명(교차 검증 포함).

## 자동 검증

| 검사 | 결과 |
|---|---|
| eslint | 에러 1 (RouletteBoard ref-during-render), 경고 1 (미사용 import) |
| tsc --noEmit | 통과 |
| vitest | 111/111 통과 |
| next build | 통과 |

## 판정

네 리뷰어 모두 **수정 후 머지**. Critical 2건과 Important 약 15건을 닫으면 배포 가능.

## Critical

### C1. RPC 함수가 anon 키만으로 호출 가능 (보안 리뷰에서 CONFIRMED)
- `supabase/migrations/0002_place_rpc.sql:70-71`
- `revoke ... from public`은 PUBLIC 의사롤 항목만 지운다. Supabase는 `alter default privileges ... grant all on functions to anon, authenticated, service_role`이 기본이라 함수 생성 시점에 롤별 명시 EXECUTE가 붙고, 이는 남는다.
- 영향: SECURITY DEFINER라 RLS 우회. 공용 `restaurants` 행 덮어쓰기(`hours_source='override'`로 영구화 가능), 비정형 `hours`로 해당 식당이 연결된 모든 사용자 홈이 UNEXPECTED(전역 DoS), 무제한 행 삽입, 타인 uuid로 장소 심기.
- 수정: 0005 마이그레이션. `revoke all ... from public, anon, authenticated` + `grant execute ... to service_role` + `alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated`. 심층 방어로 함수 내부에서 `hours_source='override'` 거부, `jsonb_array_length(p_restaurants) <= 100` 검사.

### C2. 룰렛 애니메이션이 개발 모드에서 재생되지 않음 (lint 에러의 근본 원인)
- `src/app/components/RouletteBoard.tsx:50-51`
- 애니메이션을 prop(`animKey`) 변화에 대한 effect로 구현하고 `stateRef.current = state`로 deps를 우회. App Router는 StrictMode 기본 on이라 effect가 setup→cleanup→setup으로 두 번 돌고, 1차 setup에서 `playedKey`가 기록된 뒤 2차 setup이 즉시 return하여 `npm run dev`에서는 애니메이션이 한 번도 보이지 않는다. 또 open 세션 상태로 새로고침하면 다시 돈다(스펙 07 "서버 응답을 받은 뒤"와 편차).
- 수정: `stateRef`/`playedKey`/`animKey`/effect 제거. 액션 성공 콜백에서 `playSpin(names)`를 호출해 타이머를 시작하고, unmount cleanup만 남긴다. ticker는 `state.kind`와 무관하게 `spinning`이면 그린다.

## Important

### 규칙 엔진
- **R1.** `scripts/seed-hours.ts:48`, `src/rules/hours.ts:21,35` — `{closed:false, open, close}`가 시드 검증을 통과한 뒤 런타임에서 항상 휴무. `validateDay`에서 `closed !== true` 거부, `hours.ts`는 `closed === true`로 판정.
- **R2.** `src/rules/slot.ts:14-16` — `ROULETTE_ALLOW_ANY_TIME`이 production에서도 동작해 D6/D7/D8 전부 무력화. `NODE_ENV !== 'production'` 가드 + on/off 테스트. (액션·보안 리뷰어도 동일 지적)
- **R3.** `scripts/seed-hours.ts:108` — `--reset`이 `hours_source`만 `google`로 되돌리고 값은 override 유지. D17(카카오) 이후엔 `DEFAULT_HOURS` + `'default'`로 복원해야 함. 스펙 04 `hours_source` 열거도 낡음.
- **R4.** `src/places/kakao.ts:81` — 저장 키가 `kakao:<id>`인데 스펙 10과 스크립트 주석은 `google_place_id`로만 안내. 문서·주석 갱신.

### 서버 액션·데이터·인증
- **A1.** `src/actions/admin.ts:10-17` — `isAdminEmail`이 `'use server'` export라 공개 액션 엔드포인트(관리자 이메일 열거 오라클). 보안 리뷰: 액션 ID가 클라이언트에 전달되지 않아 실제 exploit은 어려움(PARTIAL). `src/lib/admin.ts`(server-only, 동기)로 이동. (화면 리뷰어도 동일 지적)
- **A2.** `src/actions/roulette.ts:331,334-338` — confirm update에 `candidate_ids` 포함 조건 없음. reroll↔confirm 경합 시 후보 밖 식당 확정. `.contains('candidate_ids', [id])` + DB check 제약.
- **A3.** `src/proxy.ts:39-51` — 갱신된 세션 쿠키가 redirect 응답에 복사되지 않음(보안 리뷰 CONFIRMED, 영향 낮음). `response.cookies.getAll()`을 redirect에 복사.
- **A4.** `src/actions/roulette.ts:234,281,323` — `spin/reroll/confirm` id 미검증 → 22P02 → UNEXPECTED. `isUuid` 검사 후 명시적 오류 코드.
- **A5.** 스펙 11 계층 2(서버 액션 통합 테스트) 없음. admin 클라이언트 주입 가능하게 만든 뒤 분기 테스트 추가.

### 화면·외부 API
- **U1.** `src/places/kakao.ts:23-31`, `google.ts:21,65` — 네트워크 실패가 `ExternalApiError`가 아닌 `TypeError` → UNEXPECTED. 타임아웃 없음. 공통 fetch 헬퍼 + `AbortSignal.timeout(8000)` + 변환.
- **U2.** `src/places/kakao.ts:31,42,76,92` — 응답 `as T` 캐스트. `documents` 없으면 TypeError, NaN 좌표가 필터 통과. `Array.isArray` + `Number.isFinite` 가드.
- **U3.** `RouletteBoard.tsx:90`, `PlaceForm.tsx:42`, `DeletePlaceButton.tsx:33` — 액션이 `revalidatePath`를 하는데 `router.refresh()`를 또 호출해 서버 렌더 2배.
- **U4.** `src/app/components/PlacePicker.tsx:13-15` — controlled select가 `router.push` 완료 전까지 이전 값으로 튕김. `useTransition` + pending 동안 disabled.
- **U5.** 스펙 06 F1.2 "장소 0개면 장소 관리로 이동" 미구현. 홈에서 `redirect('/places')`, `no_place` 분기 정리.

### 보안
- **S1.** 개방형 가입 + `createPlace` 개수·빈도 제한 없음 → 외부 API 비용/할당량 증폭. 사용자당 장소 수 상한 + (후속) 빈도 제한.
- **S2.** `src/rules/hours.ts:16-21` — 비정형 `hours` jsonb에 TypeError. 형식 검증 후 `false` 반환, DB `check (jsonb_typeof(hours)='object')`.

## Minor (백로그 13-backlog.md에 반영)

규칙: open===close 판정 불일치, TIME_RE가 24:01~24:59 허용, 시드 검증 함수 테스트 불가, `isSlotEnded` 미사용, `nextSlotStart`에 "내일" 정보 없음, `pick.ts` 오류 이름, 스펙 05 자정 넘김 브레이크 문구, `DAY_KEYS as const`, 시드 중간 실패 시 적용 목록 미출력.
액션: 비관리자 거절 코드가 PLACE_FORBIDDEN, `server.ts` server-only 없음, 콜백 `x-forwarded-host`, 반경 clamp 스펙 미정의, 세션 상태 일관성 check, `NEXT_PUBLIC_SITE_URL` .env.example 누락, 0001 policy 재실행 불가, `listRecords` requireUser 위치.
화면: `Link` 미사용, body/main 여백 중복 + Nav 반복 렌더, AdminResetButton 확인 없음·결과 버림·requireUser 중복, ticker aria-live, Nav aria-current, 카카오 키워드 폴백이 GEOCODE_NOT_FOUND를 없앰, radius clamp 중복, `force-dynamic` 불필요, 로그인 오류 문구 스펙 08 누락.
보안: `.gitignore` `.env*`가 `!.env.example` 무력화, `src/places/search.ts` server-only 없음.

## 잘된 점 (공통)
- 시각·슬롯 판정이 전부 서버에서, `now: Date` 주입으로 테스트 가능.
- 모든 서버 액션이 `requireUser` + 소유권 검사. 쓰기 경로는 서비스 롤로 통일, 브라우저 직접 쓰기 불가.
- 동시성(23505 재조회, 조건부 update)이 스펙 06/08과 일치.
- 서버/클라이언트 경계가 정확하고 외부 API 키가 클라이언트 번들에 닿을 경로 없음.
- 오류 문구가 스펙 08과 일치하고 한 곳에서 관리.
- git 히스토리에 비밀키 커밋 없음. 로그에 PII 없음. open redirect 없음.

## 스펙 갱신 필요
- 04 `hours_source` 열거(`kakao`, `default` 추가), `google_place_id` 컬럼 의미(`kakao:` 접두).
- 10 보정 파일 키 형식, `--reset` 동작.
- 05 자정 넘김 브레이크 문구.
- 08 로그인 실패 문구, 반경 범위 위반 시 동작.
