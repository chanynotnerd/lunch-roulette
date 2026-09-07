# 13. 추후 버전 작업 목록 (백로그)

[← 인덱스](README.md)

1차(2026-09-04) 배포 범위에서 의도적으로 미룬 항목이다. 다음 버전 작업은 이 목록에서 고른다.
항목을 끝내면 이 파일에서 지우고, 관련 스펙 파일을 갱신한다.

## 기능

| 번호 | 항목 | 관련 스펙 | 메모 |
|---|---|---|---|
| B1 | 영업시간 보정 데이터 채우기 | 10 | 카카오 전환(D17)으로 모든 식당이 기본 영업시간(매일 11:00~21:00)이다. `data/hours-overrides.json`에 실제 시간을 적고 `npm run seed:hours`로 반영한다. 브레이크타임이 있는 식당부터. |
| B2 | 장소별 세션(D7 B안) 검토 | 05, 02 D7 | 현재는 슬롯당 세션 1개라 같은 슬롯에 두 장소를 돌릴 수 없다. 장소별로 돌리게 하려면 roulette_sessions 유일 제약에 place_id를 추가하고 홈 상태 조회를 장소 기준으로 바꾼다. |
| B3 | 장소 수정 | 01 제외 항목, 17 E8 | 이름, 주소, 반경 수정. 주소가 바뀌면 식당을 다시 수집한다. 재수집은 17의 수집 함수를 그대로 쓰되 사라진 식당 처리(기록이 참조하므로 삭제 대신 연결 해제)와 place_restaurants 동기화 규칙을 정해야 한다. 그때까지 45개로 만든 기존 장소나 1000m 넘는 장소는 삭제 후 재생성으로 갱신한다. |
| B4 | 레벨 확률 가중치 | 01 제외 항목, D9 | 새 식당 우선 또는 단골 우선 옵션. 룰렛 목적과 충돌 여부를 먼저 정한다. |
| B5 | 식당 제외(블랙리스트) | 없음 | 후보에서 빼고 싶은 식당을 사용자가 표시. 스펙 신설 필요. |
| B6 | 팀 공유, 알림, 테마 | 01 제외 항목 | 1차에서 제외한 그대로. |
| B7 | Google Places 소스 복귀 | 09, 12 | 결제 계정이 정상화되면 `PLACES_PROVIDER=google`로 되돌려 실제 영업시간을 받을 수 있다. 어댑터는 남겨 두었다. |
| B8 | 퍼스널 맵 장소 선택기 | 16 M4 | 회사와 집이 멀면 마커 전체 자동 맞춤이 너무 넓어진다. 홈의 PlacePicker를 재사용해 장소 중심으로 전환. |
| B9 | 퍼스널 맵 마커 클러스터링 | 16 제외 | 한 사용자의 식당이 수십 개를 넘으면 검토. 17로 장소당 최대 200개가 되어 필요성이 커졌다. |
| B10 | 내 정보 확장: 내 통계, 프로필 테이블, 회원 탈퇴 | 18 제외 | 통계(장소 수, 확정 횟수, 레벨별 식당 수)는 집계 쿼리가, 닉네임·설정은 profiles 테이블이, 탈퇴는 auth.users 삭제 흐름과 확인 단계가 필요하다. 각각 별도 스펙. |

## 품질

| 번호 | 항목 | 관련 스펙 | 메모 |
|---|---|---|---|
| Q1 | 서버 액션 통합 테스트 (로컬 Supabase) | 11 계층 2 | 2026-09-04 코드리뷰 후 `tests/actions/roulette.test.ts`에 모의 클라이언트 기반 분기 테스트(23505 재조회, 조건부 update 0건, 후보 검사)를 넣었다. 실제 DB 기준 RLS·RPC·유일 제약 검증은 아직 없다. |
| Q3 | 화면 테스트 | 11 계층 3 | 홈 상태 4개의 버튼/문구 확인. |
| Q4 | 테스트 플래그 정리 | 05 | `ROULETTE_ALLOW_ANY_TIME`(슬롯 해제, 다시 돌리기 무제한)은 테스트 전용. 2026-09-04부터 `NODE_ENV=production`이면 코드에서 무시한다(`src/rules/slot.ts`). 남은 일: 플래그 자체를 제거할지 결정. |
| Q5 | 확정 확인 문구의 조사가 받침과 무관하게 "으로" 고정 ("코엑스몰으로 확정할까요?") | 07 | 스펙 07 문구 그대로. 받침 유무에 따라 "로/으로" 선택하거나 문구를 "OO, 확정할까요?"로 바꾼다. |
| Q6 | 내 정보 화면에서 getUser 일시 오류와 비로그인을 구분하지 않음 | 18 오류 | loadProfile이 둘 다 null이라 /me → /login → / 로 조용히 튕긴다. 스펙 08 오류 문구를 쓸지 결정. |

## 코드리뷰 Minor (2026-09-04)

출처: [reviews/2026-09-04-code-review.md](../../reviews/2026-09-04-code-review.md). Critical/Important는 같은 날 수정했고, 아래는 미룬 Minor다.

| 번호 | 항목 | 파일 | 메모 |
|---|---|---|---|
| R1 | `isSlotEnded` 미사용 export | src/rules/slot.ts | 소비처는 `getSlot` 기반. 제거하거나 any-time 모드를 반영. |
| R2 | `nextSlotStart`에 "내일" 정보 없음 | src/rules/slot.ts, 스펙 08 | 21:00 이후 안내 문구가 "11:00에 열립니다"로만 나온다. `{ time, tomorrow }` 반환 + 08 문구 수정. |
| R3 | `pick.ts` 오류 이름 | src/rules/pick.ts | `Error('NOT_ENOUGH')`가 앱 코드 `NOT_ENOUGH_OPEN`과 다르다. 호출부가 사전 검사하므로 실제로는 안 던져진다. |
| R4 | `DAY_KEYS as const`, `DEFAULT_HOURS` freeze | src/rules/types.ts, src/config/default-hours.ts | 타입 캐스팅 제거와 불변성. |
| R5 | 시드 중간 실패 시 적용 목록 미출력 | scripts/seed-hours.ts | DB 오류로 멈추면 어디까지 적용됐는지 알 수 없다. |
| A1 | 비관리자 거절 코드가 `PLACE_FORBIDDEN` | src/actions/admin.ts | 문구가 "접근할 수 없는 장소입니다"라 의미가 안 맞는다. `FORBIDDEN` 코드 신설 검토. |
| A2 | 콜백 라우트가 `x-forwarded-host` 무시 | src/app/auth/callback/route.ts | 프록시/프리뷰 환경에서 origin이 어긋날 수 있다. |
| A3 | 반경 범위 위반 시 동작 스펙 미정의 | 스펙 04, 08 | 현재 clamp. 스펙에 명시. 범위는 17(D18)로 100~1000이 되었다. |
| A4 | 세션 상태 일관성 check 제약 | supabase/migrations | `status='confirmed' ⇔ chosen_restaurant_id/confirmed_at not null`. |
| A5 | 0001 `create policy` 재실행 불가 | supabase/migrations/0001_init.sql | `drop policy if exists` 선행 검토. |
| A7 | 읽기 경로도 RLS를 타게 할지 | src/actions/* | 모든 읽기가 서비스 롤이라 RLS가 실제로 안 쓰인다. `.eq('user_id')` 누락 시 방어선이 없다. |
| A8 | `google_place_id` 컬럼명 | 스펙 04 | `kakao:` 접두 값을 넣고 있다. `provider_place_id`로 rename 검토. |
| U2 | 관리자 초기화 버튼 확인 단계·실패 표시 없음 | src/app/components/AdminResetButton.tsx | `requireUser` 중복 호출도 정리. |
| U4 | 카카오 주소→키워드 폴백이 `GEOCODE_NOT_FOUND`를 사실상 없앰 | src/places/kakao.ts | 오타 주소가 엉뚱한 좌표로 잡힐 수 있다. 폴백 결과 제한 또는 로그. |
| U5 | `radius` clamp 중복, `force-dynamic` 불필요 | src/places/kakao.ts, src/app/page.tsx | 무해. 정리만. |
| U6 | `PlaceForm`을 `useActionState`로 통일 | src/app/places/PlaceForm.tsx | 현재 `onSubmit + useTransition`도 유효. Next 16 권장 방식으로 나중에. |
| U7 | confirmed 화면에 "오늘 점심/저녁"이 두 번 보임 (상단 slot-label + 결과 카드 result-slot) | src/app/(app)/page.tsx, src/app/components/RouletteBoard.tsx | 스펙 15 레이아웃(헤더에 슬롯)과 스펙 07 confirmed 행("오늘 점심: OO")이 겹친다. 스펙 결정 후 한쪽을 뺀다. 계획 A-home.md 코드 그대로 구현된 결과. |
| U8 | `stamping`이 true가 된 뒤 false로 돌아가지 않음 | src/app/components/RouletteBoard.tsx | 같은 마운트에서 두 번째 확정 시 도장 애니메이션이 안 나온다. 슬롯당 확정 1회라 실사용 영향 없음. `run()` 진입부에 `setStamping(false)`. |
| U9 | 이동·회전 중 포커스 유실 | src/app/components/PlacePicker.tsx, src/app/components/RouletteBoard.tsx | select가 `disabled`가 되고 돌리기 버튼이 언마운트되어 키보드 포커스가 body로 간다. `aria-disabled` 또는 버튼 유지 + disabled. |
| U10 | aria-live 영역이 내용과 동시에 마운트됨, 도장 "확정" 텍스트가 접근성 트리에 없음 | src/app/components/RouletteBoard.tsx | 스크린리더가 티커·확정 결과를 못 읽을 수 있다. 라이브 영역을 항상 두고 텍스트만 교체, `.result`에 sr-only "확정" 추가. |
| U11 | 삭제 확인의 "정말 삭제"와 "취소"가 같은 모양(.btn) | src/app/(app)/places/DeletePlaceButton.tsx | 파괴적 액션 구분 없음. 계획 B-places.md가 btn 지정. `.btn-primary` 또는 `.btn-danger` 신설. `.result-name padding-right 88px`로 이름이 3줄로 쪼개지는 것, `.btn-text` 터치 타깃 28px, `.btn-admin justify-self` 무효도 같은 CSS 다듬기 묶음. |
| S1 | `createPlace` 빈도 제한 | src/actions/places.ts | 사용자당 장소 수 상한은 넣었다. 분당 호출 제한은 인프라 필요. |
| S2 | 가입 제한 | src/lib/auth.ts, Supabase Auth | 아무 Google 계정이나 로그인된다. 이메일 도메인 제한 검토. |
| S3 | `npm audit` 미확인 | package.json | 리뷰 시 네트워크 타임아웃. 배포 전 재실행. |
| F1 | `PlacePicker`가 `spinning`을 모름 | src/app/components/PlacePicker.tsx | 스펙 07 "애니메이션 중 모든 버튼 잠금"인데 장소 선택은 잠기지 않는다. 기존과 같은 동작. Q3/U3과 함께. |
| F2 | 비uuid sessionId에 `SESSION_NOT_OPEN` 반환 | src/actions/roulette.ts | 문구 "이미 확정된 룰렛입니다"가 의미와 안 맞는다. A1의 `FORBIDDEN` 코드 신설과 함께. |
| F3 | 시드 스크립트 Google id 접두 경고 | scripts/seed-hours.ts | `ChIJ` 외 접두(`Eid`, `GhIJ`)도 있어 경고가 잘못 뜰 수 있다. 경고뿐이라 무해. |
| F4 | 중복 헬퍼·미사용 export | src/places/http.ts `isRecord`, src/rules/hours-schema.ts `isValidHours`/`TIME_RE` | `isRecord` ≡ `isPlainObject`. 하나로 합치고 테스트 전용 export는 정리. |
| F5 | `createPlace` 장소 수 상한 경로 테스트 없음 | tests/actions | 헬퍼 `checkPlaceLimit`만 테스트됨. count 쿼리 → 거절 연결은 Q1과 함께. |

## 운영

| 번호 | 항목 | 메모 |
|---|---|---|
| O1 | 관리자 초기화 버튼 범위 | `ADMIN_EMAILS` 계정에만 보이는 "오늘 기록 초기화"는 본인 세션만 지운다. 다른 사용자 초기화가 필요하면 별도 설계. 버튼을 홈·기록에서 내 정보 화면(18)으로 옮길지도 함께 정한다. |
| O2 | 계획 문서 갱신 | 계획 README의 기술 스택(Next 15, Google)을 실제(Next 16, 카카오)로 고친다. 세션별 계획 파일 A~E는 만들지 않고 에이전트 프롬프트로 대체했다. |

## 완료되어 목록에서 뺀 것

- 스펙 07 S3 식당 목록의 레벨 배지와 "다음 레벨까지 N회" (2026-09-04 구현)
- 장소 화면 하단 탭 (2026-09-04 구현)
- Next 16 proxy 관례로 이름 변경 (2026-09-04 진행)
- (구 B10, 번호는 내 정보 확장에 재사용) 식당 수집 45개 상한 넘기기 → 스펙 17로 설계 확정 (2026-09-07). 구현은 17의 계획을 따른다.
