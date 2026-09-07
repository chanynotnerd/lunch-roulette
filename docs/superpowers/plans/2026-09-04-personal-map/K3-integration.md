# 세션 K3: 통합 (기록 페이지 연결, listRecords 제거, 빌드, 화면 확인, 문서 갱신)

[← 인덱스](README.md). Global Constraints는 인덱스를 따른다. 선행: K1, K2 커밋 완료. 화면 확인에는 `.env.local`의 `NEXT_PUBLIC_KAKAO_JS_KEY`(주인님이 직접 넣음)가 필요하다.

**소유 파일:** `src/app/(app)/records/page.tsx`, `src/actions/records.ts`(`listRecords` 제거만), `src/app/globals.css`(K1·K2 보고서의 "부족한 클래스" 보충만), `src/types/kakao-maps.d.ts`(보고서의 부족한 타입 보충만), `docs/superpowers/specs/2026-09-04-lunch-roulette/07-screens.md`, `13-backlog.md`, `14-userflow-happy-case.md`, `15-visual-design.md`, `16-personal-map.md`, `docs/superpowers/handoff/2026-09-04-session-handoff.md`, `docs/superpowers/reviews/2026-09-04-personal-map/`(스크린샷).

**입력:** K1, K2 보고서 2개. 프롬프트에 그대로 붙어 있다. "부족한 것"과 "스펙과 다르게 한 것" 항목을 먼저 읽는다.

---

### Task K3-1: 기록 페이지 연결과 listRecords 제거

**Files:**
- Modify: `src/app/(app)/records/page.tsx` (전체 교체)
- Modify: `src/actions/records.ts` (`listRecords`와 그 전용 타입·헬퍼 삭제)

**Interfaces:**
- Consumes: `loadRecordsScreen` (`src/actions/records.ts`, K1). `RecordsScreen({ data, kakaoJsKey, adminSlot })` (K2). `AdminResetButton` (서버 컴포넌트, 변경 없음). `ERROR_MESSAGES` (`src/lib/result.ts`).

- [ ] **Step 1: `page.tsx`를 아래 내용으로 바꾼다**

```tsx
import { redirect } from 'next/navigation'
import { loadRecordsScreen } from '@/actions/records'
import { ERROR_MESSAGES } from '@/lib/result'
import AdminResetButton from '@/app/components/AdminResetButton'
import RecordsScreen from './RecordsScreen'

export const dynamic = 'force-dynamic'

/** S4. 기록: 전체 화면 지도 + 목록 오버레이. 스펙 16. 데이터는 서버에서 모아 클라이언트에 넘긴다. */
export default async function RecordsPage() {
  const result = await loadRecordsScreen()
  if (!result.ok && result.code === 'AUTH_REQUIRED') redirect('/login')

  if (!result.ok) {
    return (
      <>
        <h1 className="page-title">기록</h1>
        <p role="alert" className="alert">
          {ERROR_MESSAGES[result.code](result.params)}
        </p>
      </>
    )
  }

  return (
    <RecordsScreen
      data={result.data}
      kakaoJsKey={process.env.NEXT_PUBLIC_KAKAO_JS_KEY || null}
      adminSlot={<AdminResetButton />}
    />
  )
}
```

- [ ] **Step 2: `src/actions/records.ts`에서 옛 코드를 지운다**

지울 것: `export type RecordRow`(이제 `records-types.ts`에 있음), `type Joined`, `const DELETED_PLACE`, `function one`, `export async function listRecords`. 남길 것: `loadRecordsScreen`과 그것이 쓰는 import. 지운 뒤 `SLOTS`, `Slot`, `levelAtTime`, `levelName` import가 미사용이면 함께 지운다. 파일은 대략 아래 모양이 된다.

```ts
'use server'

import { requireUser } from '@/lib/auth'
import { fail, ok, type Result } from '@/lib/result'
import { createAdminClient } from '@/lib/supabase/admin'
import { toMarkers, toRecordRows, type JoinedRow } from '@/actions/records-helpers'
import { SEOUL_CITY_HALL, type LatLng, type RecordsScreenData } from '@/actions/records-types'

const SCREEN_SELECT = /* K1이 넣은 그대로 */
export async function loadRecordsScreen() { /* K1이 넣은 그대로 */ }
```

- [ ] **Step 3: `listRecords` 참조가 남아 있지 않은지 확인**

Run: `grep -rn "listRecords" src tests`
Expected: 출력 없음.

- [ ] **Step 4: 타입, 린트, 전체 테스트, 빌드**

Run: `npx tsc --noEmit; npm run lint; npm test; npm run build`
Expected: 오류 0, 테스트 전부 PASS, 빌드 성공. 빌드 중 `/records` 경로가 dynamic으로 잡힌다.

- [ ] **Step 5: 커밋**

```bash
git add "src/app/(app)/records/page.tsx" src/actions/records.ts
git commit -m "feat(map): 기록 탭을 퍼스널 맵으로 연결, listRecords 제거 (스펙 16)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D9kAoPJFsiCpzGBkUqNKkH"
```

---

### Task K3-2: 보고서의 부족한 것 보충

**Files:**
- Modify: `src/app/globals.css`, `src/types/kakao-maps.d.ts` (보고서에 적힌 것만)

- [ ] **Step 1: K1, K2 보고서의 "부족한 것"을 읽고 각 항목을 처리한다**

- 클래스: 보고서가 적은 이름과 CSS를 `globals.css` "퍼스널 맵" 절에 넣는다. 토큰 변수만 쓴다.
- 타입 선언: 쓰는 API가 늘었으면 `kakao-maps.d.ts`에 추가한다.
- 문구: 스펙 16 문구 표에 없는 문구를 썼으면 컴포넌트에서 표의 문구로 바꾼다(문구 표를 늘리지 않는다).
- 린트 경고(hooks 의존성): `KakaoMap.tsx`의 ref 갱신 패턴이 원인이면 그대로 둔다. 다른 원인이면 고친다.

없으면 이 Task는 건너뛰고 보고서에 "부족한 것 없음"이라 적는다.

- [ ] **Step 2: 검증과 커밋** (바꾼 것이 있을 때만)

Run: `npx tsc --noEmit; npm run lint; npm test`

```bash
git add src/app/globals.css src/types/kakao-maps.d.ts
git commit -m "fix(map): K1·K2 보고서의 부족한 클래스와 타입 보충

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D9kAoPJFsiCpzGBkUqNKkH"
```

---

### Task K3-3: 화면 확인 (390px, 실제 카카오 키)

**Files:**
- Create: `docs/superpowers/reviews/2026-09-04-personal-map/01-map.png`, `02-marker-card.png`, `03-list.png`, `04-empty.png`(가능하면), `05-failed.png`

**전제:** `.env.local`에 `NEXT_PUBLIC_KAKAO_JS_KEY`가 있고 dev 서버가 그 값으로 떠 있다. 없으면 이 Task를 멈추고 주인님께 요청한다. 값을 채팅에 적지 않는다.

- [ ] **Step 1: dev 서버 확인**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login`
Expected: `200`. 아니면 `npm run dev`를 백그라운드로 띄운다. 주인님이 Chrome에서 로그인한다.

- [ ] **Step 2: Chrome DevTools 기기 모드 390×844에서 `/records`를 보고 아래를 하나씩 확인한다**

| 번호 | 확인 | 기대 |
|---|---|---|
| 1 | 진입 | 하단 탭 위까지 지도가 차고, 마커가 전부 보이게 맞춰짐. 오른쪽 위 플로팅 버튼(흰 바탕, 검은 테두리 2겹) |
| 2 | 지도 드래그, 핀치(또는 휠) | 이동과 확대가 됨 |
| 3 | 마커 탭 | 검은 고리가 생기고 아래에 식권 카드(이름, 주소, "N회 방문, 마지막 방문 M월 D일", 도장 5칸과 레벨 이름). 플로팅 버튼이 카드와 겹치지 않음 |
| 4 | 다른 마커 탭 | 카드 교체, 고리 이동 |
| 5 | 지도 빈 곳 탭 | 카드 닫힘 |
| 6 | 플로팅 버튼 | 흰 오버레이에 "기록" 제목과 날짜별 목록(식권 더미). 버튼이 X로 바뀜. 관리자 계정이면 초기화 버튼이 제목 아래 |
| 7 | 목록 항목 탭 | 오버레이 닫히고 그 식당 마커가 선택되며 지도가 그리로 이동 |
| 8 | 플로팅 버튼(X), Esc | 오버레이 닫힘. Esc는 카드도 닫음 |
| 9 | 키보드만 | Tab으로 플로팅 버튼 → Enter → 제목에 포커스 → Tab으로 항목 → Enter → 지도로 복귀, 포커스가 플로팅 버튼 |
| 10 | 기록 없는 계정(가능하면) | 첫 장소 중심, 위쪽에 "아직 기록이 없습니다…" 상자. 목록 오버레이도 같은 문구 |
| 11 | `.env.local`의 키를 일부러 틀리게 바꾸고 dev 서버 재시작 | "지도를 표시할 수 없습니다. 목록으로 볼 수 있습니다" 상자. 플로팅 버튼과 목록은 동작. 확인 뒤 키를 원래대로 되돌리고 재시작 |
| 12 | 데스크톱 폭 | 지도와 하단 탭이 같은 480px 폭으로 가운데 정렬 |

**관리자 초기화 버튼은 누르지 않는다.** 확인할 수 없는 항목은 건너뛰고 보고서에 이유를 적는다.

- [ ] **Step 3: 스크린샷 저장**

1, 3, 6 상태는 반드시, 10과 11은 가능하면 `docs/superpowers/reviews/2026-09-04-personal-map/` 아래 위 파일명으로 저장한다.

---

### Task K3-4: 문서 갱신

**Files:**
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/07-screens.md`, `13-backlog.md`, `14-userflow-happy-case.md`, `15-visual-design.md`, `16-personal-map.md`, `docs/superpowers/handoff/2026-09-04-session-handoff.md`

- [ ] **Step 1: 07 S4를 바꾼다**

```markdown
## S4. 기록

- 전체 화면 카카오 지도. 확정한 식당마다 도장 마커 하나(숫자는 방문 횟수, 크기는 레벨). 마커 탭 시 식권 카드(이름, 주소, 도장 5칸, 방문 횟수, 마지막 방문일).
- 오른쪽 위 플로팅 버튼으로 날짜별 기록 목록 오버레이를 연다. 목록은 confirmed 세션을 날짜 내림차순으로: 날짜, 슬롯(점심/저녁), 장소 이름, 식당 이름, 확정 당시 레벨. 항목을 누르면 지도로 돌아가 그 식당 마커를 선택한다.
- 삭제된 장소는 "삭제된 장소"로 표시한다. 세부는 [16-personal-map.md](16-personal-map.md).
```

- [ ] **Step 2: 13 백로그 "기능" 표에 두 줄을 추가한다**

```markdown
| B8 | 퍼스널 맵 장소 선택기 | 16 M4 | 회사와 집이 멀면 마커 전체 자동 맞춤이 너무 넓어진다. 홈의 PlacePicker를 재사용해 장소 중심으로 전환. |
| B9 | 퍼스널 맵 마커 클러스터링 | 16 제외 | 한 사용자의 식당이 수십 개를 넘으면 검토. |
```

- [ ] **Step 3: 14 유저플로우의 기록 확인 단계에 지도를 반영한다**

기록 탭을 설명하는 문장(예: "기록 탭에서 날짜별 목록을 본다")을 "기록 탭에서 지도 위 도장 마커를 보고, 마커를 눌러 식당 카드를, 플로팅 버튼으로 날짜별 목록을 본다"로 바꾼다. Mermaid 다이어그램에 기록 노드가 있으면 라벨만 "기록(지도)"로 바꾼다. 구조는 바꾸지 않는다.

- [ ] **Step 4: 15에 개정 항목을 링크로 넣는다**

"레이아웃" 절 끝에 한 줄:

```markdown
기록 화면은 예외로 전체 화면 지도를 쓴다. 지도 위 요소의 규칙, 도장 마커 규격, 추가 문구는 [16-personal-map.md](16-personal-map.md) "시각 디자인" 절을 따른다.
```

"문구" 절 표 아래에 한 줄:

```markdown
퍼스널 맵 문구 여섯 개는 [16-personal-map.md](16-personal-map.md) "문구" 절에 있다.
```

- [ ] **Step 5: 16을 구현 사실에 맞춘다**

- "컴포넌트" 표: `initialView`가 `src/app/(app)/records/initial-view.ts`(K2)에 있다고 고친다. "순수 함수" 절의 `initialView` 항목도 같은 경로로 옮겼다고 적는다.
- "접근성" 절의 오버레이 항목: `aria-modal="true"`를 지우고 "플로팅 버튼이 닫기 역할이라 aria-modal은 두지 않는다"로 바꾼다.
- "동작" 절 "SDK 컨트롤" 항목은 그대로(구현이 컨트롤을 넣지 않았는지 K3-3에서 확인).
- K1, K2 보고서의 "스펙과 다르게 한 것" 중 받아들인 것을 반영한다.

- [ ] **Step 6: 인수인계 문서 갱신**

"현재 상태" 절에 추가:

```markdown
- 카카오 앱 "점심 룰렛"에 JavaScript 키를 쓴다(퍼스널 맵, 스펙 16). Web 플랫폼 도메인: localhost:3000, Vercel 주소. 환경변수 `NEXT_PUBLIC_KAKAO_JS_KEY`는 `.env.local`과 Vercel에 있다(Vercel 등록 여부는 배포 시 확인).
```

"다음 할 일"에 추가:

```markdown
- 퍼스널 맵 배포: Vercel 환경변수 `NEXT_PUBLIC_KAKAO_JS_KEY` 확인 후 `npx vercel --prod --yes`. 배포 후 프로덕션 도메인에서 지도가 뜨는지 확인(도메인 미등록이면 조용히 실패한다).
```

- [ ] **Step 7: 커밋**

```bash
git add docs/superpowers/specs/2026-09-04-lunch-roulette/07-screens.md docs/superpowers/specs/2026-09-04-lunch-roulette/13-backlog.md docs/superpowers/specs/2026-09-04-lunch-roulette/14-userflow-happy-case.md docs/superpowers/specs/2026-09-04-lunch-roulette/15-visual-design.md docs/superpowers/specs/2026-09-04-lunch-roulette/16-personal-map.md docs/superpowers/handoff/2026-09-04-session-handoff.md docs/superpowers/reviews/2026-09-04-personal-map
git commit -m "docs: 퍼스널 맵 적용 결과로 스펙 07/13/14/15/16과 인수인계 갱신, 스크린샷 추가

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D9kAoPJFsiCpzGBkUqNKkH"
```

- [ ] **Step 8: 보고**

커밋 해시 전부, 빌드·테스트 결과(명령 출력 그대로), 화면 확인 표 12개 항목별 결과(실제로 본 것만 "확인", 못 본 것은 이유), 스크린샷 경로, 보충한 클래스·타입, 스펙 16에 반영한 변경, 남은 문제를 적어 보고한다.
