# 2026-09-04 세션 인수인계 (식사 룰렛)

세션을 재시작하기 전에 남기는 요약이다. 다음 세션은 이 문서와 스펙 인덱스(`docs/superpowers/specs/2026-09-04-lunch-roulette/README.md`)를 먼저 읽는다.

## 프로젝트 한 줄

Google 로그인 → 장소(주소) 등록 → 카카오 로컬 API로 반경 내 식당 자동 수집 → 점심/저녁 슬롯마다 영업 중 식당 3곳 추첨 → 1곳 확정 → 날짜별 기록과 식당별 레벨(처음/익숙/단골/찐단골/집밥). 앱 이름 "식사 룰렛".

## 현재 상태 (사실)

- 저장소: `C:\Users\beafter-window\project\lunch-roulette`, 브랜치 main, 커밋 40개, 최신 `5e44946`. 원격(GitHub) 없음.
- 작업 트리에 다른 Claude 세션(코드리뷰)이 남긴 미커밋 변경 39개 파일이 있다. 테스트는 통과(222개). 그 세션이 커밋을 마치면 `npx vercel --prod --yes`로 한 번 더 배포한다.
- 프로덕션: https://lunch-roulette-sooty.vercel.app (Vercel 프로젝트 lunch-roulette, 계정 boltwriter721-2668). 로그인 화면까지 확인됨.
- Vercel production 환경변수 8개: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, KAKAO_REST_API_KEY, PLACES_PROVIDER=kakao, ADMIN_EMAILS, NEXT_PUBLIC_SITE_URL, **ROULETTE_ALLOW_ANY_TIME=true(테스트용, 끝나면 제거 후 재배포)**.
- 로컬: `.env.local`에 같은 값 + `ROULETTE_ALLOW_ANY_TIME=true`. `npm run dev`로 http://localhost:3000.
- Supabase 프로젝트 ref `ybqsyjngvdjrenylrffd`(조직 lunch-roulette, Free). 마이그레이션 0001~0004 적용 완료. Google 로그인 Enabled. Redirect URLs: localhost와 Vercel 도메인의 `/auth/callback`.
- Google Cloud 프로젝트 lunch-roulette-507605(계정 boltwriter721@gmail.com): OAuth 클라이언트 lunch-roulette-supabase, 테스트 사용자 boltwriter721@gmail.com만 등록. **Maps API는 결제 계정 해지 상태라 사용 불가** → 카카오로 전환(D17).
- 카카오 개발자 앱 "점심 룰렛"(ID 1567010), 카카오맵 사용 설정 ON, REST API 키 사용 중.
- git worktree 4개(`../lunch-roulette-A~D`, 브랜치 session-a~d)는 전부 main에 병합됨. 삭제해도 안전(약 2.2GB). 삭제는 사용자 확인 후.
- 테스트 데이터: 장소 "강남역 테스트", "청구로1길 23" 등이 boltwriter721 계정에 있다.

## 오늘 결정한 것 (스펙 02 D1~D17 외 추가)

- 테스트 플래그 `ROULETTE_ALLOW_ANY_TIME=true`: 슬롯 제한 해제(15:00 전 점심, 이후 저녁)와 다시 돌리기 무제한. 환경변수로만 제어하며 NODE_ENV와 무관(`src/rules/slot.ts`). 운영에는 넣지 않는 것이 원칙.
- 관리자 버튼: `ADMIN_EMAILS`에 있는 계정에만 홈/기록 화면에 "오늘 기록 초기화" 표시. 본인 오늘 세션만 삭제.
- 세션은 슬롯당 1개(장소 무관). 홈에 "오늘 저녁 · 장소이름"과 다른 장소 선택 시 안내 문구 표시. 장소별 세션은 백로그 B2.
- 카카오 식당은 영업시간이 없어 기본값(매일 11:00~21:00, hours_source=default). 실제 시간은 `data/hours-overrides.json` + `npm run seed:hours`.
- 앱 이름 "식사 룰렛". Next.js 16, `src/proxy.ts`(middleware 대체).

## 문서 위치

- 스펙(source of truth): `docs/superpowers/specs/2026-09-04-lunch-roulette/` 01~14. 13은 백로그, 14는 유저플로우 해피케이스(Mermaid 원본).
- 계획: `docs/superpowers/plans/2026-09-04-lunch-roulette/README.md` (배포 결과 섹션 포함).
- Figma용 SVG: `docs/figma/userflow-happy-case-1.svg`(플로우), `-2.svg`(상태 전이).
- 코드리뷰 결과(다른 세션): `docs/reviews/2026-09-04-code-review.md`.

## 다음 할 일 (우선순위)

1. **Figma MCP 연결**: 사용자가 `claude mcp add --transport http figma https://mcp.figma.com/mcp` 실행 후 세션 재시작. 첫 호출에서 Figma 로그인 승인. 무료 플랜이라 월 6회 호출 제한 가능성이 있으니 호출을 아낀다.
2. **FigJam에 해피케이스 그리기**: `create_new_file`로 FigJam 파일 생성 → `generate_diagram`에 스펙 14의 Mermaid(플로우차트)를 그대로 전달. 노드 이름은 S1/F1 번호 유지. 실패하면 SVG 수동 가져오기로 대체.
3. 테스트 끝나면 Vercel의 `ROULETTE_ALLOW_ANY_TIME` 제거 후 재배포.
4. 다른 세션의 코드리뷰 커밋 확인 후 재배포.
5. worktree 정리(사용자 확인 후): `git worktree remove ../lunch-roulette-A` (B, C, D 동일) + `git branch -d session-a session-b session-c session-d`.
6. GitHub 원격 연결과 Vercel Git 연동(선택).
7. 백로그(스펙 13) 순서대로.

## 작업 규칙 (이 프로젝트에서 합의된 것)

- superpowers 플러그인은 이 프로젝트에만 활성. brainstorming → 스펙 → writing-plans 순서.
- 문서는 파일당 한 주제로 정규화하고 README를 인덱스로 쓴다.
- 비밀 키 값은 채팅에 출력하지 않는다. 비밀번호·카드·OAuth 동의·약관 동의는 사용자가 직접 한다.
- 에이전트를 병렬로 띄울 때 5분마다 진행 상황을 보고한다.
- 삭제 등 되돌리기 어려운 작업은 사용자 확인 후 진행한다.
