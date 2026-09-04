# 세션 C: 기록, 날짜 문구 유틸, 로그인, 관리자 버튼

[← 인덱스](README.md). Global Constraints와 병렬 단계 규칙은 인덱스를 따른다. 선행: U0 커밋.

**소유 파일:** `src/app/(app)/records/page.tsx`, `src/lib/format.ts`, `tests/lib/format.test.ts`, `src/app/login/page.tsx`, `src/app/components/AdminResetButton.tsx`. 그 밖의 파일은 읽기만 한다.

---

### Task C-1: 날짜 문구 유틸 (TDD)

**Files:**
- Create: `src/lib/format.ts`
- Test: `tests/lib/format.test.ts`

**Interfaces:**
- Produces: `formatSlotDate(isoDate: string): string`. `'2026-09-04'` → `'2026년 9월 4일'`. 입력은 서버가 주는 `slot_date`(YYYY-MM-DD)뿐이다. Task C-2가 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성** `tests/lib/format.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { formatSlotDate } from '@/lib/format'

describe('formatSlotDate', () => {
  it('YYYY-MM-DD를 "YYYY년 M월 D일"로 바꾼다', () => {
    expect(formatSlotDate('2026-09-04')).toBe('2026년 9월 4일')
  })

  it('두 자리 월과 일은 앞 0을 뗀다', () => {
    expect(formatSlotDate('2026-12-25')).toBe('2026년 12월 25일')
    expect(formatSlotDate('2026-01-01')).toBe('2026년 1월 1일')
  })

  it('형식이 다르면 입력을 그대로 돌려준다', () => {
    expect(formatSlotDate('2026/09/04')).toBe('2026/09/04')
    expect(formatSlotDate('')).toBe('')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/lib/format.test.ts`
Expected: FAIL. `Failed to resolve import "@/lib/format"` 또는 비슷한 모듈 없음 오류.

- [ ] **Step 3: 구현** `src/lib/format.ts`

```ts
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일'. 형식이 다르면 그대로 돌려준다. 기록 화면 전용. 스펙 15 문구. */
export function formatSlotDate(isoDate: string): string {
  const m = ISO_DATE.exec(isoDate)
  if (!m) return isoDate
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일`
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/lib/format.test.ts`
Expected: PASS 3건.

---

### Task C-2: 기록 화면

**Files:**
- Modify: `src/app/(app)/records/page.tsx` (전체 교체)

**Interfaces:**
- Consumes: `listRecords` → `RecordRow { slotDate, slot, slotLabel, placeName, restaurantName, levelAtThatTime, levelName }` (`src/actions/records.ts`, 변경 없음). `formatSlotDate` (Task C-1). `LevelStamps({ level, levelName, nextIn, compact? })` (`src/app/components/LevelStamps.tsx`, U0). 클래스 `page-title`, `stubs`, `stub`, `stub-meta`, `stub-name`, `muted`, `alert` (U0 `globals.css`).

- [ ] **Step 1: 파일을 아래 내용으로 바꾼다**

메타 줄 "2026-09-04 · 점심 · 회사"를 "2026년 9월 4일 점심, 회사"로 바꾼다. 확정 당시 레벨은 도장 5칸으로, `nextIn`은 없으므로 `null`.

```tsx
import { redirect } from 'next/navigation'
import { listRecords } from '@/actions/records'
import { ERROR_MESSAGES } from '@/lib/result'
import { formatSlotDate } from '@/lib/format'
import AdminResetButton from '@/app/components/AdminResetButton'
import LevelStamps from '@/app/components/LevelStamps'

export const dynamic = 'force-dynamic'

/** S4. 기록: confirmed 세션을 날짜 내림차순으로. 뜯어낸 식권 더미. */
export default async function RecordsPage() {
  const result = await listRecords()
  if (!result.ok && result.code === 'AUTH_REQUIRED') redirect('/login')

  return (
    <>
      <h1 className="page-title">기록</h1>
      <AdminResetButton />
      {!result.ok ? (
        <p role="alert" className="alert">
          {ERROR_MESSAGES[result.code](result.params)}
        </p>
      ) : result.data.length === 0 ? (
        <p className="muted">아직 기록이 없습니다. 홈에서 룰렛을 돌리면 여기에 쌓입니다</p>
      ) : (
        <ul className="stubs">
          {result.data.map((r) => (
            <li key={`${r.slotDate}-${r.slot}`} className="stub">
              <p className="stub-meta">
                {formatSlotDate(r.slotDate)} {r.slotLabel}, {r.placeName}
              </p>
              <p className="stub-name">{r.restaurantName}</p>
              <LevelStamps level={r.levelAtThatTime} levelName={r.levelName} nextIn={null} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
```

- [ ] **Step 2: 타입 검사, 린트, 전체 테스트**

Run: `npx tsc --noEmit; npm run lint; npm test`
Expected: 자기 파일에서 오류 0, 테스트 전부 PASS.

- [ ] **Step 3: 화면 확인 (390px 폭)**

브라우저 `/records`: 점선 절취선 목록. 메타 줄이 "2026년 9월 4일 점심, 회사", 식당 이름이 굵은 표시 서체, 도장 5칸. 기록이 없으면 안내 문구. **관리자 초기화 버튼은 누르지 않는다**(되돌리기 어려운 작업).

---

### Task C-3: 로그인 화면과 관리자 버튼

**Files:**
- Modify: `src/app/login/page.tsx` (전체 교체)
- Modify: `src/app/components/AdminResetButton.tsx` (JSX만 교체)

**Interfaces:**
- Consumes: `signInWithGoogle` (`src/actions/auth.ts`), `resetTodaySessions` (`src/actions/admin.ts`), `isAdminEmail`, `requireUser` (변경 없음). 클래스 `login`, `login-card`, `login-title`, `muted`, `alert`, `btn`, `btn-primary`, `btn-block`, `btn-admin` (U0 `globals.css`).

- [ ] **Step 1: `src/app/login/page.tsx`를 아래 내용으로 바꾼다**

로그인은 `(app)` 그룹 밖이라 `<main>`을 직접 그린다. 부제는 스펙 15 문구 표의 것.

```tsx
import { signInWithGoogle } from '@/actions/auth'

type Props = {
  searchParams: Promise<{ error?: string }>
}

/** S1. 로그인. 스펙 07, 15. */
export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <main className="login">
      <div className="login-card">
        <h1 className="login-title">식사 룰렛</h1>
        <p className="muted">지금 영업 중인 근처 식당 3곳 중에서 고릅니다</p>
        <form action={signInWithGoogle}>
          <button type="submit" className="btn btn-primary btn-block">
            Google로 로그인
          </button>
        </form>
        {error && (
          <p role="alert" className="alert">
            로그인에 실패했습니다. 다시 시도해 주세요
          </p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: `src/app/components/AdminResetButton.tsx`의 `return (` 이하를 아래로 바꾼다**

import와 `requireUser`, `isAdminEmail` 검사는 그대로 둔다.

```tsx
  return (
    <form
      action={async () => {
        'use server'
        await resetTodaySessions()
      }}
    >
      <button type="submit" className="btn btn-admin">
        오늘 기록 초기화 (관리자)
      </button>
    </form>
  )
```

- [ ] **Step 3: 타입 검사, 린트, 화면 확인**

Run: `npx tsc --noEmit; npm run lint`
Expected: 자기 파일에서 오류 0.

브라우저: 시크릿 창으로 `/login`(로그아웃하지 않는다. 다른 세션이 같은 개발 서버로 화면을 보고 있다). 가운데 큰 제목, 부제, 빨간 로그인 버튼. `/login?error=auth`면 빨간 오류 문구. 관리자 계정이면 `/records` 상단에 빨간 점선 테두리의 작은 버튼.

- [ ] **Step 4: 커밋**

```bash
git add src/lib/format.ts tests/lib/format.test.ts "src/app/(app)/records/page.tsx" src/app/login/page.tsx src/app/components/AdminResetButton.tsx
git commit -m "feat(ui): 기록을 식권 더미로, 로그인과 관리자 버튼 스타일, formatSlotDate 추가 (스펙 15)"
```

- [ ] **Step 5: 보고**

바꾼 파일, 커밋 해시, 테스트 결과, 확인한 화면 목록(실제로 본 것만), 부족한 클래스, 남의 파일에서 본 오류를 적어 보고한다.
