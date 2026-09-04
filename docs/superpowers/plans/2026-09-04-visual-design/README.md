# 시각 디자인(단골 도장 카드) 구현 계획 (인덱스)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스타일 없는 화면 4개에 스펙 15의 "단골 도장 카드" 시각 언어를 입힌다. 동작, 서버 액션, 문구는 바꾸지 않는다.

**Architecture:** 토큰과 모든 컴포넌트 클래스를 `src/app/globals.css` 한 곳에 두고, 각 컴포넌트는 인라인 스타일을 버리고 클래스만 쓴다. 홈, 장소, 기록은 `(app)` 라우트 그룹 레이아웃이 `<main>`과 하단 탭을 그린다. 레벨 배지는 `LevelStamps` 컴포넌트 하나로 통일한다. 기반(U0)을 먼저 커밋한 뒤 화면 3묶음을 서브에이전트 3개가 동시에 작업한다.

**Tech Stack:** Next.js 16 App Router, `next/font/google`(Black Han Sans, IBM Plex Sans KR), 순수 CSS(전처리기·CSS 모듈 없음), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-lunch-roulette/15-visual-design.md`. 화면 구조는 `07-screens.md`, 문구는 `08-errors.md`.

## Global Constraints

- 토큰: paper #FFFFFF, ink #000000, seal #D62E2E, seal-deep #B3201F, muted #6F6F6F, rule #E3E3E3. (스펙 15)
- 서체: 표시 Black Han Sans 400, 본문 IBM Plex Sans KR 400/500/700. `next/font/google`로 넣는다. (스펙 15)
- 화면 문구는 07, 08 그대로. 새 문구는 스펙 15 "문구" 표의 5개만. (스펙 15)
- 가운뎃점(·) 연결, 눈썹 대문자 라벨, 카드 그림자, 크림색 바탕은 쓰지 않는다. (스펙 15)
- 움직임은 티커 회전과 도장 찍힘 두 번뿐. `prefers-reduced-motion: reduce`면 둘 다 끈다. (스펙 15)
- 서버 액션과 `HomeState` 타입은 건드리지 않는다. 화면은 서버 판정을 그대로 보여 준다. (스펙 03)
- 상태 관리 패턴은 기존 그대로: `useTransition` + 액션 성공 직후에만 애니메이션 재생. prop 변화 effect로 재생하지 않는다. (RouletteBoard 주석)
- 인라인 `style={{…}}`은 남기지 않는다. 클래스는 U0가 `globals.css`에 정의한 것만 쓴다. 클래스가 부족하면 만들지 말고 세션 보고서에 적는다. D가 모아서 넣는다.
- 작업 트리에 이전 세션의 미커밋 변경 42개가 있다. 커밋할 때 `git add`는 자기 세션이 소유한 파일만 명시한다. `git add -A`, `git add .` 금지.
- 이미 끝난 사전 작업: `src/app/page.tsx`, `src/app/places/**`, `src/app/records/**`는 `git mv`로 `src/app/(app)/` 아래로 옮겨져 있다(내용은 그대로). 모든 세션이 이 위치를 전제로 한다.

---

## 세션 구성과 의존 관계

| 세션 | 파일 | 담당 | 선행 | 예상 시간 |
|---|---|---|---|---|
| U0 | [U0-foundation.md](U0-foundation.md) | 토큰, 서체, 전체 CSS 클래스, (app) 레이아웃, 하단 탭, LevelStamps | 없음. **main에서 가장 먼저 단독 실행 후 커밋** | 15분 |
| A | [A-home.md](A-home.md) | 홈: 장소 선택, 메뉴판, 식권, 도장 | U0 커밋 | 20분 |
| B | [B-places.md](B-places.md) | 장소 관리, 장소 상세, 장소 폼, 삭제 버튼 | U0 커밋 | 15분 |
| C | [C-records-login.md](C-records-login.md) | 기록, 날짜 문구 유틸, 로그인, 관리자 버튼 | U0 커밋 | 15분 |
| D | [D-integration.md](D-integration.md) | 빌드, 스크린샷 검토, 부족한 클래스 보충, 스펙 07/13/14 갱신 | A, B, C 완료 | 15분 |

실행 순서:

1. main에서 U0를 실행하고 커밋한다. 이 시점에 화면은 뼈대만 바뀌고 옛 인라인 스타일이 섞여 있어도 된다.
2. A, B, C를 서브에이전트 3개로 **같은 작업 트리에서** 동시에 실행한다. worktree를 쓰지 않는다. 이유: 미커밋 변경 42개가 main 작업 트리에만 있어 worktree에는 없다.
   - 파일 소유권이 겹치지 않으므로 서로의 파일을 읽기만 하고 쓰지 않으면 충돌이 없다.
   - 각 세션은 자기 파일만 `git add`해서 커밋한다. 커밋 순서는 상관없다.
   - `npm run dev` 서버는 한 번만 띄운다(주인님 또는 U0가 띄운 것을 공유). 각 세션은 브라우저 확인만 한다.
3. 세 세션의 보고서를 받은 뒤 D를 실행한다.

병렬 단계 규칙(A, B, C 공통):

- `src/app/globals.css`는 **읽기 전용**이다. 클래스가 없으면 인라인 스타일로 때우지 말고, 보고서 "부족한 클래스" 항목에 클래스 이름과 원하는 CSS를 적는다.
- `src/app/components/LevelStamps.tsx`, `Nav.tsx`, `src/app/(app)/layout.tsx`, `src/app/layout.tsx`도 읽기 전용.
- 타입 검사는 `npx tsc --noEmit`, 린트는 `npm run lint`. 다른 세션이 작업 중이라 잠깐 실패할 수 있다. 자기 파일에서 난 오류만 고치고, 남의 파일 오류는 보고서에 적는다.
- 보고서 형식: 바꾼 파일, 커밋 해시, 확인한 화면 목록, 부족한 클래스, 남의 파일에서 본 오류.

## 파일 소유권 (세션 간 충돌 방지)

| 경로 | 소유 세션 |
|---|---|
| `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/components/Nav.tsx`, `src/app/components/LevelStamps.tsx` | U0 (병렬 단계에서는 D만 수정 가능) |
| `src/app/components/PlacePicker.tsx`, `src/app/components/RouletteBoard.tsx`, `src/app/(app)/page.tsx` | A |
| `src/app/(app)/places/**` | B |
| `src/app/(app)/records/page.tsx`, `src/lib/format.ts`, `tests/lib/format.test.ts`, `src/app/login/page.tsx`, `src/app/components/AdminResetButton.tsx` | C |
| `docs/superpowers/specs/2026-09-04-lunch-roulette/07-screens.md`, `13-backlog.md`, `14-userflow-happy-case.md` | D |

## 서브에이전트 정의

`.claude/agents/`에 아래 4개를 둔다. 이름이 진행 상황 표시에 그대로 나온다.

| 파일 | 이름 | 세션 |
|---|---|---|
| `ui-a-home.md` | 세션 A 홈 화면 | A |
| `ui-b-places.md` | 세션 B 장소 화면 | B |
| `ui-c-records-login.md` | 세션 C 기록·로그인 | C |
| `ui-d-integration.md` | 세션 D 통합·검토 | D |

각 에이전트에는 해당 세션 파일 경로와 "파일 소유권 표 밖의 파일은 쓰지 않는다"를 프롬프트에 넣는다. 5분마다 진행 상황을 주인님께 보고한다.

## 배포

이 계획 밖이다. 주인님이 지시하면 `git push` 후 Vercel 자동 배포 결과를 확인한다.
