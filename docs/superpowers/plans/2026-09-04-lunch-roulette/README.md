# 점심 메뉴 룰렛 구현 계획 (인덱스)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인한 사용자가 장소를 등록하면 근처 식당이 자동 수집되고, 점심/저녁 슬롯마다 영업 중인 식당 3곳을 뽑아 하나를 확정해 기록과 레벨로 남기는 웹앱을 1시간 안에 배포 가능한 상태로 만든다.

**Architecture:** Next.js App Router 앱 하나. 모든 규칙 판단은 서버 액션에서 Asia/Seoul 기준으로 수행하고, 쓰기는 서비스 롤 키로만 한다. 순수 함수(rules)와 외부 API 어댑터(places)를 서버 액션(actions)과 분리해 세션별로 병렬 구현한다.

**Tech Stack:** Next.js 15 (App Router, TypeScript, src 디렉터리), @supabase/supabase-js, @supabase/ssr, Vitest, tsx. Supabase (Postgres, Auth Google), Vercel, Google Geocoding API, Google Places API (New) Text Search.

**Spec:** `docs/superpowers/specs/2026-09-04-lunch-roulette/README.md` (인덱스). 각 작업은 관련 스펙 파일을 명시한다.

## Global Constraints

- 시간대는 항상 Asia/Seoul. 시간을 다루는 모든 함수는 `now: Date`를 인자로 받는다. (스펙 03)
- 슬롯: lunch 11:00~15:00, dinner 17:00~21:00. 시작 포함, 끝 미포함. (스펙 05)
- 레벨 테이블: 1 처음 0 / 2 익숙 1 / 3 단골 3 / 4 찐단골 7 / 5 집밥 15. `src/config/levels.ts` 한 곳에만 둔다. (스펙 05)
- hours JSON 요일 키는 mon, tue, wed, thu, fri, sat, sun 7개 전부. 시각은 "HH:MM". 24시간은 "00:00"~"24:00". (스펙 04)
- hours가 null인 식당은 후보에서 제외. (스펙 05, D14)
- 서버 액션 응답은 `{ ok: true, data }` 또는 `{ ok: false, code, params }`. 예외를 던지지 않는다. 오류 코드는 스펙 08의 11개 + UNEXPECTED. (스펙 08)
- 브라우저에서 Supabase에 쓰지 않는다. 모든 쓰기는 서비스 롤 클라이언트로. (스펙 03)
- Google API 요청 필드는 id, displayName, formattedAddress, location, regularOpeningHours로 제한. (스펙 09)
- 1시간 제약에 따른 축소: 단위 테스트는 rules와 places/convert만. 서버 액션 통합 테스트는 미룬다. 화면은 스타일 없이 동작 우선. 스파이크(스펙 12)는 세션 C의 첫 실제 장소 생성으로 대체. (합의 사항)

---

## 세션 구성과 의존 관계

| 세션 | 파일 | 담당 | 선행 | 예상 시간 |
|---|---|---|---|---|
| A0 | [A-foundation.md](A-foundation.md) Task A1 | 스캐폴드, 공통 타입, Result 타입 | 없음. **main에서 가장 먼저 단독 실행** | 5분 |
| A | [A-foundation.md](A-foundation.md) Task A2~A4 | Supabase 클라이언트, DB 마이그레이션, 로그인 | A0 | 20분 |
| B | [B-rules.md](B-rules.md) | 순수 규칙 함수 + 단위 테스트 | A0 | 20분 |
| C | [C-places.md](C-places.md) | Google 어댑터, 장소 서버 액션, 장소 화면, 시드 스크립트 | A0 (A의 스키마는 스펙 04 기준으로 작성) | 25분 |
| D | [D-roulette.md](D-roulette.md) | 룰렛 서버 액션, 홈 화면, 기록 화면 | A, B, C 병합 후 | 20분 |
| E | [E-integration.md](E-integration.md) | 병합, 빌드, 배포, 수동 확인 | D | 10분 |

병렬 실행 순서:

1. main에서 A0(Task A1)를 실행하고 커밋한다.
2. A, B, C를 각각 worktree에서 동시에 실행한다. (superpowers:using-git-worktrees)
   - `git worktree add ../lunch-roulette-A -b session-a`
   - `git worktree add ../lunch-roulette-B -b session-b`
   - `git worktree add ../lunch-roulette-C -b session-c`
3. A, B, C 브랜치를 main에 순서대로 병합한다. 파일이 겹치지 않도록 설계했으므로 충돌은 없어야 한다.
4. D를 main(또는 새 worktree)에서 실행한다.
5. E를 실행한다.

## 파일 소유권 (세션 간 충돌 방지)

| 경로 | 소유 세션 |
|---|---|
| package.json, tsconfig, next.config, vitest.config, src/app/layout.tsx, src/app/globals.css, src/rules/types.ts, src/lib/result.ts | A0 |
| src/lib/supabase/*, src/middleware.ts, src/app/login/*, src/app/auth/*, src/actions/auth.ts, supabase/migrations/0001_init.sql, .env.example | A |
| src/config/*, src/rules/* (types.ts 제외), tests/rules/* | B |
| src/places/*, src/actions/places.ts, src/app/places/*, supabase/migrations/0002_place_rpc.sql, scripts/seed-hours.ts, data/hours-overrides.json, tests/places/* | C |
| src/actions/roulette.ts, src/actions/records.ts, src/app/page.tsx, src/app/records/*, src/app/components/* | D |

## 주인님이 직접 해야 하는 준비 (세션 A, B, C가 도는 동안 병행)

에이전트가 대신할 수 없는 계정 작업이다. 세션 D 시작 전까지 끝나야 한다.

- [ ] Supabase 프로젝트 생성. Project URL, anon key, service_role key를 복사한다.
- [ ] Google Cloud 콘솔에서 OAuth 클라이언트 ID(웹) 생성. 승인된 리디렉션 URI에 `https://<supabase-project-ref>.supabase.co/auth/v1/callback` 추가.
- [ ] Supabase 대시보드 → Authentication → Providers → Google 켜고 위 클라이언트 ID와 시크릿 입력.
- [ ] Supabase → Authentication → URL Configuration → Site URL에 `http://localhost:3000`, Redirect URLs에 `http://localhost:3000/auth/callback` 추가. (배포 후 Vercel 도메인도 추가)
- [ ] Google Cloud에서 Geocoding API, Places API (New) 활성화. API 키 발급 후 "API 제한"으로 이 둘만 허용.
- [ ] Google Cloud → API 및 서비스 → 할당량에서 Places API (New) 요청/일 30, Geocoding API 요청/일 30으로 제한. 예산 알림 1달러 설정. (스펙 09)
- [ ] 저장소 루트에 `.env.local` 작성:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_MAPS_API_KEY=...
```

- [ ] Supabase SQL Editor에서 `supabase/migrations/0001_init.sql`, `0002_place_rpc.sql`, `0003_sessions_place_nullable.sql`을 순서대로 실행. (세션 A, C가 파일을 만든 뒤. 0003은 코드리뷰 후 추가)

## 세션 E 인계 항목 (2026-09-04 세션 C 2부 코드리뷰에서 이월)

세션 C 2부(장소 액션/화면) 리뷰에서 나온 항목 중 세션 E 통합 단계로 넘긴 것.

- [ ] **장소별 식당 목록에 레벨 배지와 "다음 레벨까지 N회" 표시** (스펙 07 S3, 06 F8). `src/app/places/[id]/page.tsx`와 `listPlaceRestaurants`에 확정 횟수 집계를 붙이고 `src/rules/level.ts`로 계산한다. 세션 D의 `roulette-helpers.ts` `countXp`, `toCandidate`를 재사용할 수 있다.
- [ ] **장소 화면 두 곳에 공통 하단 탭 적용** (스펙 07 공통). `src/app/places/page.tsx`, `src/app/places/[id]/page.tsx`의 인라인 `<nav>`를 세션 D의 `src/app/components/Nav.tsx`로 교체한다. 현재는 기록 탭으로 가는 링크가 없다.
- [ ] **수동 확인 시나리오 추가**: 장소 생성 → 돌리기 → 확정 → 그 장소 삭제 → 기록 화면에 "삭제된 장소" 표시. (0003 마이그레이션 회귀 확인)
- [ ] 참고: 실제 설치된 Next는 16이다. `src/middleware.ts`는 `proxy.ts` 관례로 바뀌었으므로 빌드 시 경고가 나면 이름을 바꾼다.
