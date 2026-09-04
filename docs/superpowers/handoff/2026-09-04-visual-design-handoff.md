# 2026-09-04 시각 디자인 작업 인수인계 (식사 룰렛)

시각 디자인 작업을 새 세션에서 시작하기 위한 요약이다. 프로젝트 전체 상태는 [2026-09-04-session-handoff.md](2026-09-04-session-handoff.md)를 본다.

## 무엇을 하려는가

스타일 없는 화면 4개에 "단골 도장 카드" 시각 언어를 입힌다. 동작, 서버 액션, 문구는 바꾸지 않는다.
컨셉과 토큰은 스펙 15, 실행 순서와 코드는 계획 디렉터리에 있다.

| 문서 | 경로 |
|---|---|
| 스펙 15 시각 디자인 | `docs/superpowers/specs/2026-09-04-lunch-roulette/15-visual-design.md` |
| 계획 인덱스 | `docs/superpowers/plans/2026-09-04-visual-design/README.md` |
| 세션별 계획 | 같은 디렉터리의 `U0-foundation.md`, `A-home.md`, `B-places.md`, `C-records-login.md`, `D-integration.md` |
| 서브에이전트 정의 | `.claude/agents/ui-a-home.md`, `ui-b-places.md`, `ui-c-records-login.md`, `ui-d-integration.md` |

## 지금 작업 트리 상태 (2026-09-04 기준, 사실)

- 커밋은 하나도 안 했다. 최신 커밋은 여전히 `ea345da`.
- **파일 이동만 stage에 잡혀 있다.** `git mv`로 `src/app/page.tsx`, `src/app/places/**`, `src/app/records/**`를 `src/app/(app)/` 아래로 옮겼다. 내용은 그대로라 상대 경로 import(`./components/...`, `../components/...`)가 깨진 상태다. U0 Task U0-2 Step 3에서 고친다. 그 전까지 `npx tsc --noEmit`은 실패한다. 정상이다.
- 이전 세션(코드리뷰)의 미커밋 변경 42개 파일이 같은 작업 트리에 있다. 건드리지 않는다. 커밋할 때 `git add -A` 금지, 계획에 적힌 파일만 명시한다.
- 스펙 15, README 인덱스 갱신, 계획 디렉터리, 에이전트 정의 4개, 이 문서는 미커밋(untracked)이다. U0 커밋에 함께 넣는다(U0-3 Step 3의 git add 목록에 이 문서 경로 `docs/superpowers/handoff/2026-09-04-visual-design-handoff.md`도 추가한다).
- 개발 서버가 떠 있었을 수 있다(node 프로세스 3개). 디렉터리 이름 변경이 "Permission denied"로 막힌 적이 있다. 새 세션에서 파일 이동이 막히면 dev 서버를 먼저 끈다.

## 새 세션에서 시작하는 순서

1. 이 문서와 계획 README를 읽는다.
2. `superpowers:subagent-driven-development` 스킬을 쓴다.
3. U0를 **메인 세션에서 직접** 실행하고 커밋한다(에이전트에 맡기지 않는다. 뒤 세션이 전부 U0의 클래스 이름에 의존하므로 계획 코드를 그대로 넣는 것이 중요하다). 커밋 해시를 기록한다.
4. 에이전트 "세션 A 홈 화면", "세션 B 장소 화면", "세션 C 기록·로그인"을 **한 메시지에서 동시에** 띄운다. 프롬프트에는 각자의 계획 파일 경로, U0 커밋 해시, "소유 파일 밖은 쓰지 말 것", 보고서 형식을 넣는다. 5분마다 진행 상황을 주인님께 보고한다.
5. 보고서 3개를 모아 "세션 D 통합·검토"를 띄운다. 프롬프트에 보고서 3개를 그대로 붙인다.
6. D의 보고를 받고 주인님께 결과를 보고한다. 배포는 지시가 있을 때만.

## 계획에서 정한 것 (다시 논의하지 않는다)

- worktree를 쓰지 않는다. 미커밋 변경 42개가 main 작업 트리에만 있기 때문이다. 같은 트리에서 파일 소유권으로 충돌을 막는다.
- `globals.css`와 공용 컴포넌트는 병렬 단계에서 읽기 전용. 부족한 클래스는 보고서에 적고 D가 넣는다.
- 모든 CSS 클래스는 U0가 한 번에 정의한다. 각 세션이 CSS를 따로 만들지 않는다.
- 에이전트는 장소 삭제, 장소 추가(외부 API 호출), 관리자 초기화, 공용 dev 서버 로그아웃을 하지 않는다.
- 서체는 `next/font/google`(Black Han Sans, IBM Plex Sans KR). 네트워크가 막혀 실패하면 U0에서 멈추고 보고한다. 대체 경로를 임의로 만들지 않는다.

## 화면 확인에 필요한 것

- `npm run dev` → http://localhost:3000. 로그인은 주인님 Google 계정(boltwriter721)으로 Chrome에서 직접.
- 돌리기·확정 확인에는 `.env.local`의 `ROULETTE_ALLOW_ANY_TIME=true`가 필요하다(이미 켜져 있을 것).
- 확정은 오늘 슬롯의 세션을 만든다. 관리자 계정이면 홈의 "오늘 기록 초기화" 버튼으로 되돌릴 수 있다(주인님이 직접).

## 이 작업이 끝나면

- 기존 인수인계 문서의 "다음 할 일" 3번(Figma Design 유저플로우)이 열린다: 새 화면을 Vercel에 배포한 뒤 프로덕션 화면을 캡처해 Figma에 올린다.
- 스펙 13 백로그에서 Q2, U1, U3가 지워진다(D가 한다). F1(PlacePicker가 spinning을 모름)은 남는다.
