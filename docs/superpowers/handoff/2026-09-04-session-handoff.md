# 2026-09-04 세션 인수인계 (식사 룰렛)

세션을 재시작하기 전에 남기는 요약이다. 다음 세션은 이 문서와 스펙 인덱스(`docs/superpowers/specs/2026-09-04-lunch-roulette/README.md`)를 먼저 읽는다.

## 프로젝트 한 줄

Google 로그인 → 장소(주소) 등록 → 카카오 로컬 API로 반경 내 식당 자동 수집 → 점심/저녁 슬롯마다 영업 중 식당 3곳 추첨 → 1곳 확정 → 날짜별 기록과 식당별 레벨(처음/익숙/단골/찐단골/집밥). 앱 이름 "식사 룰렛".

## 현재 상태 (사실)

- 저장소: `C:\Users\beafter-window\project\lunch-roulette`, 브랜치 main, 커밋 40개, 최신 `5e44946`. 원격(GitHub) 없음.
- 작업 트리에 다른 Claude 세션(코드리뷰)이 남긴 미커밋 변경 39개 파일이 있다. 테스트는 통과(222개). 그 세션이 커밋을 마치면 `npx vercel --prod --yes`로 한 번 더 배포한다.
- **정식 주소(2026-09-08부터): https://lunch.rouleat.biz** — 이 노트북의 Docker 셀프호스팅(Supabase self-host + Next.js + Cloudflare Tunnel). 구성·운영·백업은 `deploy/README.md`. 데이터는 클라우드에서 이전하지 않고 새로 시작했다.
- 예전 프로덕션 https://lunch-roulette-sooty.vercel.app (Vercel 프로젝트 lunch-roulette, 계정 boltwriter721-2668)과 Supabase 클라우드 프로젝트는 삭제하지 않고 pause 보관. Supabase는 2026-09-08 pause 완료, Vercel pause는 CLI 대화형 확인이 필요해 사용자가 `npx vercel project pause lunch-roulette`로 직접 실행. 되돌릴 때는 둘 다 unpause.
- Vercel production 환경변수 8개: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, KAKAO_REST_API_KEY, PLACES_PROVIDER=kakao, ADMIN_EMAILS, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_KAKAO_JS_KEY. ROULETTE_ALLOW_ANY_TIME은 2026-09-07 제거 후 재배포 완료(운영에서는 슬롯 밖이면 '다음 룰렛은 HH:MM에 열립니다').
- 로컬: `.env.local`에 같은 값 + `ROULETTE_ALLOW_ANY_TIME=true`. `npm run dev`로 http://localhost:3000.
- Supabase 프로젝트 ref `ybqsyjngvdjrenylrffd`(조직 lunch-roulette, Free). 마이그레이션 0001~0004 적용 완료. Google 로그인 Enabled. Redirect URLs: localhost와 Vercel 도메인의 `/auth/callback`.
- Google Cloud 프로젝트 lunch-roulette-507605(계정 boltwriter721@gmail.com): OAuth 클라이언트 lunch-roulette-supabase, 테스트 사용자 boltwriter721@gmail.com만 등록. **Maps API는 결제 계정 해지 상태라 사용 불가** → 카카오로 전환(D17).
- 카카오 개발자 앱 "점심 룰렛"(ID 1567010), 카카오맵 사용 설정 ON, REST API 키 사용 중.
- 카카오 앱 "점심 룰렛"에 JavaScript 키를 쓴다(퍼스널 맵, 스펙 16). Web 플랫폼 도메인: localhost:3000, Vercel 주소. 환경변수 `NEXT_PUBLIC_KAKAO_JS_KEY`는 `.env.local`과 Vercel에 있다(Vercel 등록 여부는 배포 시 확인). JS SDK 도메인은 카카오 콘솔의 플랫폼 키 > JavaScript 키 > 수정 화면에서 등록했다(localhost:3000, lunch-roulette-sooty.vercel.app).
- git worktree 4개(`../lunch-roulette-A~D`, 브랜치 session-a~d)는 전부 main에 병합됨. 삭제해도 안전(약 2.2GB). 삭제는 사용자 확인 후.
- 테스트 데이터: 장소 "강남역 테스트", "청구로1길 23" 등이 boltwriter721 계정에 있다.

## 오늘 결정한 것 (스펙 02 D1~D17 외 추가)

- 테스트 플래그 `ROULETTE_ALLOW_ANY_TIME=true`: 슬롯 제한 해제(15:00 전 점심, 이후 저녁)와 다시 돌리기 무제한. 환경변수로만 제어하며 NODE_ENV와 무관(`src/rules/slot.ts`). 운영에는 넣지 않는 것이 원칙.
- 관리자 버튼: `ADMIN_EMAILS`에 있는 계정에만 홈/기록 화면에 "오늘 기록 초기화" 표시. 본인 오늘 세션만 삭제.
- 세션은 슬롯당 1개(장소 무관). 홈에 "오늘 저녁 · 장소이름"과 다른 장소 선택 시 안내 문구 표시. 장소별 세션은 백로그 B2.
- 카카오 식당은 영업시간이 없어 기본값(매일 11:00~21:00, hours_source=default). 실제 시간은 `data/hours-overrides.json` + `npm run seed:hours`.
- 앱 이름 "식사 룰렛". Next.js 16, `src/proxy.ts`(middleware 대체).

## 문서 위치

- 스펙(source of truth): `docs/superpowers/specs/2026-09-04-lunch-roulette/` 01~18. 13은 백로그, 14는 유저플로우 해피케이스(Mermaid 원본), 15는 시각 디자인, 16은 퍼스널 맵(기록 탭 지도), 17은 식당 수집 확장, 18은 내 정보(마이페이지).
- 계획: `docs/superpowers/plans/2026-09-04-lunch-roulette/README.md` (배포 결과 섹션 포함).
- Figma Design 화면 캡처 플로우(완료, 2026-09-07 갱신): https://www.figma.com/design/swDjWYtHqtZzFEZmw31mdW. 캡처 13장(①~⑧ 09-04, ⑨ 지도·⑩ 카드·⑪ 목록·⑫ 내 정보 09-07), 섹션 6개, 범례. FigJam 보드도 v2 플로우차트와 v2 범례를 추가(옛 버전은 사용자가 삭제).
- Figma export 재사용 가이드: `docs/figma/userflow-export-guide.md` (참고 파일, 절차, 스크립트 템플릿, 체크리스트). 캡처 원본: `docs/figma/captures/`.
- FigJam 보드(완료): https://www.figma.com/board/TYKrI6JL3kwlVwbXDZyTXL. 예비용 SVG: `docs/figma/userflow-happy-case-1.svg`(플로우), `-2.svg`(상태 전이).
- 코드리뷰 결과(다른 세션): `docs/reviews/2026-09-04-code-review.md`.

## 다음 할 일 (우선순위)

1. ~~Figma MCP 연결~~ 완료. 이 프로젝트 Local 범위로 등록됨(`claude mcp get figma`). 플랜은 "김찬영의 팀"(team::1676518265841055462, starter) 하나.
2. ~~FigJam에 해피케이스 그리기~~ 완료. `generate_diagram`이 파일을 직접 만들므로 `create_new_file`은 필요 없다. 보드 URL은 스펙 14에 기록.
3. ~~Figma Design 유저플로우~~ 완료. https://www.figma.com/design/swDjWYtHqtZzFEZmw31mdW — 프로덕션 캡처 9장(로그인, 장소 관리, 장소 상세, 홈 세션 없음, 애니메이션, 후보 3장, 확정 확인, 확정 결과, 기록)을 가로 배치하고 섹션 5개와 범례 패널을 넣음. 캡처 원본은 세션 스크래치패드에만 있음. 홈 세션 없음 캡처에 마우스 커서가 찍혀 있어 재캡처 여지 있음.
4. ~~테스트 끝나면 Vercel의 `ROULETTE_ALLOW_ANY_TIME` 제거 후 재배포.~~ 2026-09-07 완료.
5. 다른 세션의 코드리뷰 커밋 확인 후 재배포.
6. worktree 정리(사용자 확인 후): `git worktree remove ../lunch-roulette-A` (B, C, D 동일) + `git branch -d session-a session-b session-c session-d`.
7. GitHub 원격 연결과 Vercel Git 연동(선택).
8. 백로그(스펙 13) 순서대로.
9. 퍼스널 맵 배포: Vercel 환경변수 `NEXT_PUBLIC_KAKAO_JS_KEY` 확인 후 `npx vercel --prod --yes`. 배포 후 프로덕션 도메인에서 지도가 뜨는지 확인(도메인 미등록이면 조용히 실패한다).
10. ~~스펙 17 식당 수집 확장~~ 2026-09-07 구현·배포 완료. 키워드 9개 × 셀(500m 초과 2×2 rect), 동시 5, 거리순 200개, 반경 상한 1000m. 스파이크 결과는 스펙 17 결과 표. 기존 45개로 만든 장소는 지우고 다시 만들어야 늘어난다(E8, B3). 마이그레이션 0006(RPC 식당 상한 100→300)을 Supabase에 적용했다. 카카오 로컬 일 할당량은 키워드·주소 각 100,000회(콘솔 확인).
11. 내 정보 화면(스펙 18) 2026-09-07 구현 완료(브랜치 feat/spec-18-my-page, 로컬에서 화면·이니셜 대체·탭 확인). 배포는 main 병합 후. 계획 `docs/superpowers/plans/2026-09-07-my-page.md`. 통계·탈퇴는 백로그 B10.

## 작업 규칙 (이 프로젝트에서 합의된 것)

- superpowers 플러그인은 이 프로젝트에만 활성. brainstorming → 스펙 → writing-plans 순서.
- 문서는 파일당 한 주제로 정규화하고 README를 인덱스로 쓴다.
- 비밀 키 값은 채팅에 출력하지 않는다. 비밀번호·카드·OAuth 동의·약관 동의는 사용자가 직접 한다.
- 에이전트를 병렬로 띄울 때 5분마다 진행 상황을 보고한다.
- 삭제 등 되돌리기 어려운 작업은 사용자 확인 후 진행한다.
