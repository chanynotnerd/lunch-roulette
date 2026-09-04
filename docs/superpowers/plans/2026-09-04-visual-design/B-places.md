# 세션 B: 장소 관리, 장소 상세, 장소 폼, 삭제 버튼

[← 인덱스](README.md). Global Constraints와 병렬 단계 규칙은 인덱스를 따른다. 선행: U0 커밋.

**소유 파일:** `src/app/(app)/places/**` (page.tsx, [id]/page.tsx, PlaceForm.tsx, DeletePlaceButton.tsx). 그 밖의 파일은 읽기만 한다.

---

### Task B-1: 장소 화면

**Files:**
- Modify: `src/app/(app)/places/page.tsx` (전체 교체)
- Modify: `src/app/(app)/places/[id]/page.tsx` (전체 교체)
- Modify: `src/app/(app)/places/PlaceForm.tsx` (JSX 부분만 교체)
- Modify: `src/app/(app)/places/DeletePlaceButton.tsx` (JSX 부분만 교체)

**Interfaces:**
- Consumes: `listPlaces`, `listPlaceRestaurants`, `createPlace`, `deletePlace` (`src/actions/places.ts`, 변경 없음). `LevelStamps({ level, levelName, nextIn, compact? })` (`src/app/components/LevelStamps.tsx`, U0). 클래스 `page-title`, `section`, `section-title`, `rows`, `row`, `row-title`, `row-meta`, `muted`, `small`, `alert`, `back-link`, `form`, `field`, `input`, `btn`, `btn-block`, `btn-text`, `confirm`, `confirm-actions` (U0 `globals.css`).
- Produces: 없음(화면 말단).

- [ ] **Step 1: `src/app/(app)/places/page.tsx`를 아래 내용으로 바꾼다**

U0가 이미 `<main>`과 `Nav`를 뺐다. 여기서는 본문을 클래스 기반으로 다시 쓴다. "반경 500m · 식당 12곳"의 가운뎃점을 쉼표로 바꾼다.

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listPlaces } from '@/actions/places'
import { ERROR_MESSAGES } from '@/lib/result'
import DeletePlaceButton from './DeletePlaceButton'
import PlaceForm from './PlaceForm'

export const dynamic = 'force-dynamic'

/** S3. 장소 관리. */
export default async function PlacesPage() {
  const result = await listPlaces()
  if (!result.ok && result.code === 'AUTH_REQUIRED') redirect('/login')

  return (
    <>
      <h1 className="page-title">장소 관리</h1>

      <section className="section">
        <h2 className="section-title">내 장소</h2>
        {!result.ok ? (
          <p role="alert" className="alert">
            {ERROR_MESSAGES[result.code](result.params)}
          </p>
        ) : result.data.length === 0 ? (
          <p className="muted">아직 장소가 없습니다. 아래에서 장소를 추가해 주세요.</p>
        ) : (
          <ul className="rows">
            {result.data.map((p) => (
              <li key={p.id} className="row">
                <Link href={`/places/${p.id}`} className="row-title">
                  {p.name}
                </Link>
                <p className="muted small">{p.address}</p>
                <p className="row-meta">
                  반경 {p.radius_m}m, 식당 {p.restaurant_count}곳
                </p>
                <DeletePlaceButton placeId={p.id} placeName={p.name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">장소 추가</h2>
        <PlaceForm />
      </section>
    </>
  )
}
```

- [ ] **Step 2: `src/app/(app)/places/[id]/page.tsx`를 아래 내용으로 바꾼다**

"← 장소 목록" 링크의 화살표 문자를 빼고 "장소 목록으로"로 쓴다(스킬: 링크 글자에 화살표 붙이지 않기).

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listPlaceRestaurants } from '@/actions/places'
import { ERROR_MESSAGES } from '@/lib/result'
import LevelStamps from '@/app/components/LevelStamps'

export const dynamic = 'force-dynamic'

/** S3. 장소에 연결된 식당 목록. */
export default async function PlaceRestaurantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await listPlaceRestaurants(id)
  if (!result.ok && result.code === 'AUTH_REQUIRED') redirect('/login')

  return (
    <>
      <Link href="/places" className="back-link">
        장소 목록으로
      </Link>
      <h1 className="page-title">연결된 식당</h1>
      {!result.ok ? (
        <p role="alert" className="alert">
          {ERROR_MESSAGES[result.code](result.params)}
        </p>
      ) : result.data.length === 0 ? (
        <p className="muted">{ERROR_MESSAGES.PLACE_NO_RESTAURANTS()}</p>
      ) : (
        <ul className="rows">
          {result.data.map((r) => (
            <li key={r.id} className="row">
              <p className="row-title">{r.name}</p>
              <p className="muted small">{r.address}</p>
              <LevelStamps level={r.level} levelName={r.levelName} nextIn={r.nextIn} />
              {!r.has_hours && <p className="row-meta">영업시간 정보 없음</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
```

- [ ] **Step 3: `src/app/(app)/places/PlaceForm.tsx`의 `return (` 이하를 아래로 바꾼다**

import, 상태(`name`, `address`, `radius`, `message`, `pending`), `onSubmit`은 그대로 둔다. 버튼 문구는 "추가"에서 "장소 추가"로 바꾼다. 섹션 제목과 같은 말을 써서 동작이 이어진다.

```tsx
  return (
    <form onSubmit={onSubmit} className="form">
      <label className="field">
        이름
        <input
          className="input"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={50}
          placeholder="예: 회사"
          disabled={pending}
        />
      </label>
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
      <label className="field">
        반경(m)
        <input
          className="input"
          name="radius"
          type="number"
          min={100}
          max={2000}
          step={50}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          required
          disabled={pending}
        />
      </label>
      <button type="submit" className="btn btn-block" disabled={pending}>
        {pending ? '식당을 찾는 중…' : '장소 추가'}
      </button>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'alert' : 'muted'}>
          {message.text}
        </p>
      )}
    </form>
  )
```

- [ ] **Step 4: `src/app/(app)/places/DeletePlaceButton.tsx`의 두 `return` 블록을 아래로 바꾼다**

import, 상태(`confirming`, `pending`, `error`), `onConfirm`은 그대로 둔다.

```tsx
  if (!confirming) {
    return (
      <div>
        <button type="button" className="btn-text" onClick={() => setConfirming(true)}>
          삭제
        </button>
      </div>
    )
  }

  return (
    <div className="confirm">
      <p>{placeName}을(를) 삭제할까요?</p>
      <div className="confirm-actions">
        <button type="button" className="btn" onClick={onConfirm} disabled={pending}>
          {pending ? '삭제 중…' : '정말 삭제'}
        </button>
        <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={pending}>
          취소
        </button>
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
    </div>
  )
```

- [ ] **Step 5: 타입 검사, 린트, 화면 확인**

Run: `npx tsc --noEmit; npm run lint`
Expected: 자기 파일 4개에서 오류 0. 다른 세션 파일의 오류는 보고서에 적고 넘어간다.

브라우저(390px 폭) `/places`:
- 장소가 실선 괘선 목록으로, 이름은 굵은 표시 서체, 그 아래 주소(회색), "반경 500m, 식당 12곳".
- 삭제 → "OO을(를) 삭제할까요?" + 정말 삭제/취소 → 취소. **실제 삭제는 하지 않는다**(되돌리기 어려운 작업).
- 장소 이름 클릭 → `/places/<id>`에 식당마다 도장 5칸과 "다음 레벨까지 N회". 맨 위 "장소 목록으로" 링크.
- 폼 입력창 테두리가 검정 1.5px, 버튼 "장소 추가". 실제 장소 추가는 외부 API를 호출하므로 하지 않는다.
- 가로 스크롤이 없다.

- [ ] **Step 6: 커밋**

```bash
git add "src/app/(app)/places"
git commit -m "feat(ui): 장소 관리, 장소 상세, 장소 폼 스타일 (스펙 15)"
```

- [ ] **Step 7: 보고**

바꾼 파일, 커밋 해시, 확인한 화면 목록(실제로 본 것만), 부족한 클래스, 남의 파일에서 본 오류를 적어 보고한다.
