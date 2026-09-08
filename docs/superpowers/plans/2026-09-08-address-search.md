# 주소 검색(카카오 우편번호 서비스) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장소 추가 폼의 주소 칸을 카카오 우편번호 서비스 임베드로 바꿔, 사용자가 검색해서 고른 도로명 주소가 들어오게 하고 직접 입력 폴백을 남긴다.

**Architecture:** 클라이언트 컴포넌트 `AddressField`가 우편번호 스크립트 로드, 검색 모드/직접 입력 모드, 임베드 열고 닫기를 맡고 `PlaceForm`에는 `value`/`onChange`만 노출한다. 콜백 데이터에서 저장 문자열을 고르는 순수 함수 `pickAddress`만 단위 테스트한다. 서버 액션, 지오코딩, DB는 그대로다.

**Tech Stack:** Next.js 16(App Router, `next/script`), React 19, 카카오 우편번호 서비스 v2(키 없음), Vitest, 전역 CSS(`src/app/globals.css`).

**Spec:** `docs/superpowers/specs/2026-09-04-lunch-roulette/19-address-search.md` (커밋 861fb95. README 인덱스 갱신됨)

## Global Constraints

- 스펙 19 A1·A6: 스크립트는 `https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js`를 카카오 CDN에서 `next/script`로 받는다. 번들에 넣거나 수정하지 않는다. 하단 카카오 로고를 가리지 않는다.
- 스펙 19 A2: 팝업(`open()`) 금지. `embed(container, { autoClose: true })`만 쓴다.
- 스펙 19 A3: 저장 문자열은 `roadAddress` → `jibunAddress` → `address` 순. `userSelectedType`은 읽지 않는다. 우편번호·건물명은 저장하지 않는다.
- 스펙 19 A4·A5: 직접 입력 폴백을 남긴다. `src/actions/*`, `src/places/*`, 스펙 04·05·08은 바꾸지 않는다. 새 오류 코드 없음.
- 문구는 스펙 19 그대로: 읽기 전용 칸 placeholder "주소 검색을 눌러 주세요", 버튼 "주소 검색"/"검색 닫기"/"불러오는 중…", 텍스트 버튼 "직접 입력"/"주소 검색", 직접 입력 placeholder "도로명 주소", 실패 안내 "주소 검색을 불러오지 못했습니다. 직접 입력해 주세요".
- 검색 영역 높이 400px(서비스 최소값), 너비 100%. 로드 시간 초과 10초.
- 스펙 15: 빨간 버튼(`.btn-primary`)은 홈의 돌리기 하나뿐. 새 버튼은 `.btn`과 `.btn-text`.
- ESLint는 `eslint-config-next` 16(react-hooks 컴파일러 규칙 포함). effect 안에서 동기 `setState`를 부르지 않는다. 열림 여부와 모드는 상태를 조합한 파생값으로 계산한다(Task 2 코드 참조).
- 테스트는 `tests/**/*.test.ts`에 둔다(vitest 설정). `@` 별칭은 `src`.
- 커밋마다 `npm test`와 `npm run lint`가 통과해야 한다. Task 3 이후는 `npm run build`도 통과해야 한다.
- 이 저장소는 다른 세션이 `docs/figma/*`와 `docs/superpowers/specs/2026-09-04-lunch-roulette/14-userflow-happy-case.md`를 동시에 작업 중이다. 그 파일들은 건드리지 않고, 커밋할 때는 이 계획의 파일만 `git add`한다(`git add -A` 금지).

커밋 꼬리말(모든 커밋 공통):

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rj3kBJQMrL8LcvtUyBg5Ny
```

## 파일 구조

| 파일 | 역할 | 작업 |
|---|---|---|
| `src/app/(app)/places/address-helpers.ts` | `PostcodeData` 타입, 순수 함수 `pickAddress` | 생성 (Task 1) |
| `tests/app/address-helpers.test.ts` | `pickAddress` 분기 5개 | 생성 (Task 1) |
| `src/types/daum-postcode.d.ts` | `window.daum.Postcode` 선언. 이 앱이 쓰는 것만 | 생성 (Task 1) |
| `src/app/globals.css` | `.address-search`, `.address-actions` 두 클래스 | 수정 (Task 2) |
| `src/app/(app)/places/AddressField.tsx` | 스크립트 로드, 모드, 임베드. `value`/`onChange`/`disabled` | 생성 (Task 2) |
| `src/app/(app)/places/PlaceForm.tsx` | 주소 `<label>` 블록을 `AddressField`로 교체 | 수정 (Task 3) |
| `docs/superpowers/specs/2026-09-04-lunch-roulette/07-screens.md`, `06-flows.md`, `09-external-api.md`, `13-backlog.md` | 스펙 19 "바꾸는 파일" 표의 한 줄씩 | 수정 (Task 4) |

---

### Task 1: `pickAddress` 순수 함수와 타입 선언

**Files:**
- Create: `src/app/(app)/places/address-helpers.ts`
- Create: `tests/app/address-helpers.test.ts`
- Create: `src/types/daum-postcode.d.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `pickAddress(data: PostcodeData): string`, `type PostcodeData`, 전역 `window.daum?.Postcode`(Task 2가 쓴다)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/app/address-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { pickAddress } from '@/app/(app)/places/address-helpers'

describe('pickAddress', () => {
  it('roadAddress가 있으면 도로명을 고른다', () => {
    expect(
      pickAddress({
        roadAddress: '경기 성남시 분당구 판교역로 166',
        jibunAddress: '경기 성남시 분당구 백현동 532',
        address: '경기 성남시 분당구 백현동 532',
        userSelectedType: 'J',
      }),
    ).toBe('경기 성남시 분당구 판교역로 166')
  })

  it('roadAddress가 없으면 jibunAddress를 고른다', () => {
    expect(pickAddress({ roadAddress: '', jibunAddress: '경기 성남시 분당구 백현동 532' })).toBe(
      '경기 성남시 분당구 백현동 532',
    )
  })

  it('둘 다 없으면 address를 고른다', () => {
    expect(pickAddress({ address: '서울 중구 세종대로 110' })).toBe('서울 중구 세종대로 110')
  })

  it('앞뒤 공백을 지운다', () => {
    expect(pickAddress({ roadAddress: '  서울 중구 세종대로 110  ' })).toBe('서울 중구 세종대로 110')
  })

  it('전부 비어 있으면 빈 문자열', () => {
    expect(pickAddress({})).toBe('')
    expect(pickAddress({ roadAddress: '   ', jibunAddress: '', address: undefined })).toBe('')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/app/address-helpers.test.ts`
Expected: FAIL. `Failed to resolve import "@/app/(app)/places/address-helpers"`.

- [ ] **Step 3: 구현**

`src/app/(app)/places/address-helpers.ts`:

```ts
/**
 * 카카오 우편번호 서비스 oncomplete 데이터에서 저장할 주소 문자열을 고른다. 스펙 19 A3.
 * 서비스가 주는 필드 중 이 앱이 읽는 것만 적는다.
 */
export type PostcodeData = {
  roadAddress?: string
  jibunAddress?: string
  address?: string
  userSelectedType?: 'R' | 'J'
}

/** roadAddress → jibunAddress → address 순서. 앞뒤 공백 제거. 전부 비면 빈 문자열. */
export function pickAddress(data: PostcodeData): string {
  for (const candidate of [data.roadAddress, data.jibunAddress, data.address]) {
    const trimmed = typeof candidate === 'string' ? candidate.trim() : ''
    if (trimmed) return trimmed
  }
  return ''
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/app/address-helpers.test.ts`
Expected: PASS 5건.

- [ ] **Step 5: 타입 선언 작성**

`src/types/daum-postcode.d.ts`:

```ts
/**
 * 카카오 우편번호 서비스(구 Daum Postcode) v2 중 이 앱이 쓰는 것만 선언한다. 스펙 19.
 * 타입 패키지를 깔지 않는다. 팝업(open)은 쓰지 않으므로 선언하지 않는다(A2).
 */

import type { PostcodeData } from '@/app/(app)/places/address-helpers'

export type DaumPostcodeOptions = {
  oncomplete: (data: PostcodeData) => void
  onclose?: (state: 'FORCE_CLOSE' | 'COMPLETE_CLOSE') => void
  width?: string | number
  height?: string | number
}

export type DaumPostcodeInstance = {
  embed(element: HTMLElement, options?: { q?: string; autoClose?: boolean }): void
}

declare global {
  interface Window {
    daum?: { Postcode?: new (options: DaumPostcodeOptions) => DaumPostcodeInstance }
  }
}
```

- [ ] **Step 6: 타입 검사와 린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 오류 없음.

- [ ] **Step 7: 커밋**

```bash
git add src/app/\(app\)/places/address-helpers.ts tests/app/address-helpers.test.ts src/types/daum-postcode.d.ts
git commit -m "feat(places): 우편번호 콜백에서 주소 고르는 pickAddress와 daum.Postcode 타입 선언 (스펙 19)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rj3kBJQMrL8LcvtUyBg5Ny"
```

---

### Task 2: `AddressField` 컴포넌트와 CSS

**Files:**
- Create: `src/app/(app)/places/AddressField.tsx`
- Modify: `src/app/globals.css` (`.input:disabled` 블록 바로 뒤, 약 621~623행)

**Interfaces:**
- Consumes: `pickAddress`, `PostcodeData`(Task 1), 전역 `window.daum`(Task 1)
- Produces: `default AddressField({ value: string; onChange: (address: string) => void; disabled: boolean })` (Task 3가 쓴다)

이 컴포넌트는 iframe과 외부 스크립트에 묶여 있어 단위 테스트하지 않는다(스펙 19 테스트 절). 대신 lint, tsc, 그리고 Task 4의 수동 확인으로 검증한다.

- [ ] **Step 1: CSS 추가**

`src/app/globals.css`의 `.input:disabled { ... }` 블록 뒤에:

```css
/* 장소 추가 폼의 주소 검색(스펙 19). 카카오 우편번호 iframe이 들어가는 영역. 하단 카카오 로고를 가리지 않는다. */
.address-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.address-search {
  height: 400px;
  border: 1.5px solid var(--ink);
  border-radius: 4px;
  overflow: hidden;
  background: var(--paper);
}
```

- [ ] **Step 2: 컴포넌트 작성**

`src/app/(app)/places/AddressField.tsx`:

```tsx
'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { pickAddress } from './address-helpers'

/**
 * 장소 추가 폼의 주소 칸. 스펙 19.
 * 검색 모드: 읽기 전용 칸 + "주소 검색" 버튼 + 카카오 우편번호 임베드.
 * 직접 입력 모드: 지금까지의 텍스트 입력. 스크립트 로드에 실패하면 자동으로 이 모드가 된다.
 * 열림 여부와 모드는 상태를 조합한 파생값이다. effect 안에서 setState를 부르지 않는다(react-hooks 규칙).
 */

const SCRIPT_URL = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
const LOAD_TIMEOUT_MS = 10_000

type Props = {
  value: string
  onChange: (address: string) => void
  disabled: boolean
}

function postcodeReady(): boolean {
  return typeof window !== 'undefined' && Boolean(window.daum?.Postcode)
}

export default function AddressField({ value, onChange, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [manual, setManual] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  /** 사용자가 열어 둔 상태. */
  const [open, setOpen] = useState(false)
  /** 스크립트 로드 전에 "주소 검색"을 눌렀다. 로드가 끝나면 바로 열린다. */
  const [pendingOpen, setPendingOpen] = useState(false)

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const manualMode = failed || manual
  const showSearch = !disabled && !manualMode && (open || (pendingOpen && loaded))
  const loadingLabel = pendingOpen && !loaded

  // 같은 탭에서 다시 들어오면 Script onLoad가 안 오므로 시간 초과 판정은 window를 직접 본다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (postcodeReady()) return
      console.error('[AddressField] 우편번호 스크립트 로드 시간 초과')
      setFailed(true)
    }, LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [])

  // 열릴 때 임베드를 만들고, 닫히면 비운다.
  useEffect(() => {
    const el = containerRef.current
    const Postcode = window.daum?.Postcode
    if (!showSearch || !el || !Postcode) return
    el.innerHTML = ''
    new Postcode({
      oncomplete: (data) => {
        onChangeRef.current(pickAddress(data))
        setOpen(false)
        setPendingOpen(false)
      },
      onclose: () => {
        setOpen(false)
        setPendingOpen(false)
      },
      width: '100%',
      height: '100%',
    }).embed(el, { autoClose: true })
    return () => {
      el.innerHTML = ''
    }
  }, [showSearch])

  function toggleSearch() {
    if (showSearch) {
      setOpen(false)
      setPendingOpen(false)
      return
    }
    if (loaded || postcodeReady()) {
      setOpen(true)
    } else {
      setPendingOpen(true)
    }
  }

  function switchMode(next: boolean) {
    setManual(next)
    setOpen(false)
    setPendingOpen(false)
  }

  return (
    <>
      {!failed && (
        <Script
          src={SCRIPT_URL}
          strategy="afterInteractive"
          onLoad={() => setLoaded(true)}
          onError={() => {
            console.error('[AddressField] 우편번호 스크립트 로드 실패')
            setFailed(true)
          }}
        />
      )}
      <label className="field">
        주소
        {manualMode ? (
          <input
            className="input"
            name="address"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required
            maxLength={200}
            placeholder="도로명 주소"
            disabled={disabled}
          />
        ) : (
          <input
            className="input"
            name="address"
            value={value}
            readOnly
            required
            placeholder="주소 검색을 눌러 주세요"
            disabled={disabled}
            onClick={toggleSearch}
          />
        )}
      </label>
      <div className="address-actions">
        {manualMode ? (
          <span />
        ) : (
          <button type="button" className="btn" onClick={toggleSearch} disabled={disabled || loadingLabel}>
            {loadingLabel ? '불러오는 중…' : showSearch ? '검색 닫기' : '주소 검색'}
          </button>
        )}
        {failed ? null : (
          <button type="button" className="btn-text" onClick={() => switchMode(!manualMode)} disabled={disabled}>
            {manualMode ? '주소 검색' : '직접 입력'}
          </button>
        )}
      </div>
      {failed && <p className="muted small">주소 검색을 불러오지 못했습니다. 직접 입력해 주세요</p>}
      {showSearch && <div ref={containerRef} className="address-search" aria-label="주소 검색" />}
    </>
  )
}
```

동작 메모(구현자가 알아야 할 것):

- `showSearch`가 `disabled`를 포함하므로 제출 중에는 검색 영역이 자동으로 닫힌다(스펙 19 "제출 중").
- `failed`가 true면 `manualMode`가 true가 되고 "주소 검색"·"직접 입력" 버튼이 모두 숨는다. 안내 한 줄만 남는다.
- 모드를 바꿔도 `value`는 부모가 들고 있으므로 유지된다.
- 읽기 전용 칸도 `onClick`으로 검색을 여는 것은 편의 기능이다. `required`는 readOnly input에도 걸린다.
- `maxLength={200}`은 `src/actions/places-helpers.ts`의 `ADDRESS_MAX`와 같은 값이다. 서버가 다시 검사하므로 import하지 않는다(그 모듈은 서버 전용 코드와 함께 있다).

- [ ] **Step 3: 타입 검사와 린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 오류 없음. `react-hooks/set-state-in-effect` 경고가 나오면 파생값 규칙을 어긴 것이므로 effect 안의 setState를 지우고 위 코드대로 맞춘다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(app\)/places/AddressField.tsx src/app/globals.css
git commit -m "feat(places): AddressField — 카카오 우편번호 임베드, 직접 입력 폴백, 로드 실패 자동 전환 (스펙 19)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rj3kBJQMrL8LcvtUyBg5Ny"
```

---

### Task 3: `PlaceForm`에 연결

**Files:**
- Modify: `src/app/(app)/places/PlaceForm.tsx` (주소 `<label>` 블록, 약 59~70행)

**Interfaces:**
- Consumes: `AddressField`(Task 2)
- Produces: 없음. `createPlace` 호출과 성공 후 초기화(`setAddress('')`)는 그대로.

- [ ] **Step 1: import 추가**

`src/app/(app)/places/PlaceForm.tsx` 상단 import에 한 줄:

```ts
import AddressField from './AddressField'
```

- [ ] **Step 2: 주소 블록 교체**

다음 블록을

```tsx
      <label className="field">
        주소
        <input
          className="input"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          placeholder="도로명 주소"
          disabled={pending}
        />
      </label>
```

이걸로 바꾼다:

```tsx
      <AddressField value={address} onChange={setAddress} disabled={pending} />
```

나머지(이름, 반경, 제출 버튼, 메시지, `onSubmit`)는 손대지 않는다.

- [ ] **Step 3: 빌드와 테스트**

Run: `npm test && npm run lint && npm run build`
Expected: 테스트 전부 PASS, 린트 오류 없음, 빌드 성공. 빌드 출력에 `/places` 경로가 있어야 한다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(app\)/places/PlaceForm.tsx
git commit -m "feat(places): 장소 추가 폼 주소 칸을 AddressField로 교체 (스펙 19)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rj3kBJQMrL8LcvtUyBg5Ny"
```

---

### Task 4: 수동 확인과 스펙 문서 갱신

**Files:**
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/07-screens.md` (S3 장소 관리, "장소 추가 폼" 줄, 약 37행)
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/06-flows.md` (장소 생성 1단계, 약 15행)
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/09-external-api.md` (카카오 절, 약 55행 뒤)
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/13-backlog.md` (U4 행, 약 54행)

**Interfaces:**
- Consumes: Task 3까지의 앱
- Produces: 없음

- [ ] **Step 1: 개발 서버로 수동 확인**

Run: `npm run dev` (별도 터미널 또는 백그라운드). 브라우저로 `http://localhost:3000/places` 접속(로그인 필요).

확인 목록. 하나라도 어긋나면 해당 Task로 돌아가 고친다:

1. 주소 칸이 읽기 전용이고 placeholder "주소 검색을 눌러 주세요"가 보인다. 아래에 "주소 검색" 버튼과 "직접 입력" 텍스트 버튼.
2. "주소 검색"을 누르면 아래에 400px 높이 검색 영역이 펼쳐지고, 버튼 문구가 "검색 닫기"로 바뀐다. 하단 카카오 로고가 보인다.
3. "판교역로 166"을 검색해 고르면 검색 영역이 닫히고 칸에 "경기 성남시 분당구 판교역로 166"이 들어간다.
4. 이름 "테스트 판교", 반경 500으로 제출하면 "장소를 추가했습니다. 식당 N곳을 찾았습니다"가 뜨고 칸이 비워진다. 목록에 그 장소가 도로명 주소로 보인다.
5. "직접 입력"을 누르면 텍스트 입력으로 바뀌고, 다시 "주소 검색"을 누르면 읽기 전용 칸으로 돌아오며 입력했던 문자열이 남아 있다.
6. 직접 입력으로 "서울 중구 세종대로 110"을 넣고 제출해도 성공한다.
7. 브라우저 개발자 도구 네트워크 탭에서 `postcode.v2.js`를 차단하고 새로 고침하면, 최대 10초 뒤 직접 입력 모드로 바뀌고 "주소 검색을 불러오지 못했습니다. 직접 입력해 주세요"가 보인다. 두 버튼은 없다.
8. 반응형 모드 390px 폭에서 검색 영역이 폼 안에 들어가고 가로 스크롤이 없다.
9. 4번과 6번에서 만든 테스트 장소는 확인 뒤 장소 상세에서 삭제한다.

- [ ] **Step 2: 07-screens.md 갱신**

"장소 추가 폼: 이름, 주소, 반경(기본 500, 100~1000. D18)." 줄을 다음으로 바꾼다:

```
- 장소 추가 폼: 이름, 주소, 반경(기본 500, 100~1000. D18). 주소는 카카오 우편번호 검색으로 고르고, 직접 입력 폴백이 있다. 세부는 [19-address-search.md](19-address-search.md).
```

- [ ] **Step 3: 06-flows.md 갱신**

"1. 사용자가 이름, 주소, 반경(기본 500m)을 입력한다." 줄을 다음으로 바꾼다:

```
1. 사용자가 이름, 주소, 반경(기본 500m)을 입력한다. 주소는 카카오 우편번호 검색으로 고르거나 직접 입력한다([19-address-search.md](19-address-search.md)). 서버는 어느 경로인지 구분하지 않는다.
```

- [ ] **Step 4: 09-external-api.md 갱신**

카카오 할당량 줄(`- 카카오 할당량: ...`) 바로 뒤에 한 줄 추가:

```
- 주소 검색 UI: 카카오 우편번호 서비스(`t1.kakaocdn.net/.../postcode.v2.js`). 브라우저가 직접 로드한다. 키 없음, 무료, 호출 제한 없음. 좌표는 주지 않으므로 주소→좌표는 위의 서버 지오코딩 그대로. 세부는 [19-address-search.md](19-address-search.md).
```

- [ ] **Step 5: 13-backlog.md 갱신**

U4 행의 마지막 칸 끝에 덧붙인다:

```
 스펙 19 적용 후 검색 경로에서는 발생하지 않는다. 직접 입력 경로만 남는다.
```

- [ ] **Step 6: 커밋**

```bash
git add docs/superpowers/specs/2026-09-04-lunch-roulette/07-screens.md docs/superpowers/specs/2026-09-04-lunch-roulette/06-flows.md docs/superpowers/specs/2026-09-04-lunch-roulette/09-external-api.md docs/superpowers/specs/2026-09-04-lunch-roulette/13-backlog.md
git commit -m "docs(spec): 07/06/09/13에 주소 검색(스펙 19) 반영

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Rj3kBJQMrL8LcvtUyBg5Ny"
```

---

## 배포(계획 밖, 사용자 확인 후)

셀프호스팅(rouleat.biz)은 Docker 이미지 재빌드가 필요하다. `deploy/` 절차는 인수인계 문서를 따른다. 환경 변수 추가 없음.
`14-userflow-happy-case.md`는 다른 세션이 작업 중이므로 이 계획에서 건드리지 않는다. 배포 확인 뒤 별도로 갱신한다.
