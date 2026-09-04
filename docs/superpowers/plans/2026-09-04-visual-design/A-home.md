# 세션 A: 홈 화면 (장소 선택, 메뉴판, 식권, 도장)

[← 인덱스](README.md). Global Constraints와 병렬 단계 규칙은 인덱스를 따른다. 선행: U0 커밋.

**소유 파일:** `src/app/components/PlacePicker.tsx`, `src/app/components/RouletteBoard.tsx`, `src/app/(app)/page.tsx`. 그 밖의 파일은 읽기만 한다.

---

### Task A-1: 홈 화면

**Files:**
- Modify: `src/app/components/PlacePicker.tsx` (전체 교체)
- Modify: `src/app/components/RouletteBoard.tsx` (전체 교체)
- Modify: `src/app/(app)/page.tsx` (전체 교체)

**Interfaces:**
- Consumes: `HomeState`, `spin`, `reroll`, `confirm` (`src/actions/roulette.ts`, 변경 없음). `LevelStamps({ level, levelName, nextIn, compact? })` (`src/app/components/LevelStamps.tsx`, U0). `ERROR_MESSAGES`, `Result` (`src/lib/result.ts`). 클래스 `home-top`, `place-select-wrap`, `place-select`, `slot-label`, `board`, `board-name`, `board-caption`, `tickets`, `ticket`, `ticket-main`, `ticket-name`, `ticket-address`, `ticket-stub`, `confirm`, `confirm-actions`, `result`, `result-slot`, `result-name`, `seal`, `is-stamping`, `levelup`, `btn`, `btn-primary`, `btn-block`, `section`, `alert`, `note`, `muted`, `small`, `sr-only`, `page-title` (U0 `globals.css`).
- Produces: 없음(화면 말단).

- [ ] **Step 1: `src/app/components/PlacePicker.tsx`를 아래 내용으로 바꾼다**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type Option = { id: string; name: string }

/** 장소 선택. 바꾸면 /?place=<id>로 이동한다. 이동이 끝날 때까지 고른 값을 유지하고 select 를 잠근다. */
export default function PlacePicker({ places, selectedId }: { places: Option[]; selectedId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // 로컬 값은 prop 에서 시작하고, prop 이 바뀌면(서버가 다른 장소를 골랐을 때) 다시 맞춘다.
  const [value, setValue] = useState(selectedId)
  const [lastProp, setLastProp] = useState(selectedId)
  if (selectedId !== lastProp) {
    setLastProp(selectedId)
    setValue(selectedId)
  }

  return (
    <label className="place-select-wrap">
      <span className="sr-only">장소</span>
      <select
        className="place-select"
        value={value}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value
          setValue(next)
          startTransition(() => {
            router.push(`/?place=${encodeURIComponent(next)}`)
          })
        }}
      >
        {places.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
```

- [ ] **Step 2: `src/app/components/RouletteBoard.tsx`를 아래 내용으로 바꾼다**

로직(타이머, `run`, 잠금)은 기존과 같다. 바뀐 것은 (1) `stamping` 상태: 확정 액션 성공 직후에만 true, (2) `prefersReducedMotion()`이면 티커를 건너뛴다, (3) 렌더링 전부 클래스 기반, (4) `spinning`이면 상태 종류와 무관하게 메뉴판만 그린다.

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { confirm, reroll, spin, type HomeState } from '@/actions/roulette'
import { ERROR_MESSAGES, type Result } from '@/lib/result'
import LevelStamps from './LevelStamps'

const SPIN_MS = 1800
const TICK_MS = 80

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 룰렛 영역. 상태 판단은 서버 응답을 그대로 따른다. 스펙 07 S2, 15. */
export default function RouletteBoard({ state, placeId }: { state: HomeState; placeId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [pickId, setPickId] = useState<string | null>(null)

  // 애니메이션: 돌리기/다시 돌리기/확정 액션이 성공한 직후에만 재생한다. (스펙 07 "서버 응답을 받은 뒤")
  // prop 변화에 대한 effect 로 만들지 않는다. StrictMode 의 이중 setup 과 새로고침 시 재생 문제를 피하기 위해서다.
  const [spinning, setSpinning] = useState(false)
  const [tickerName, setTickerName] = useState('')
  const [stamping, setStamping] = useState(false)
  const timers = useRef<{ interval: ReturnType<typeof setInterval> | null; stop: ReturnType<typeof setTimeout> | null }>({
    interval: null,
    stop: null,
  })

  function clearTimers() {
    const t = timers.current
    if (t.interval) clearInterval(t.interval)
    if (t.stop) clearTimeout(t.stop)
    t.interval = null
    t.stop = null
  }

  // unmount 시에만 타이머를 정리한다.
  useEffect(() => clearTimers, [])

  function playSpin(names: string[]) {
    if (names.length === 0 || prefersReducedMotion()) return
    clearTimers()
    let i = 0
    setSpinning(true)
    setTickerName(names[0])
    timers.current.interval = setInterval(() => {
      i = (i + 1) % names.length
      setTickerName(names[i])
    }, TICK_MS)
    timers.current.stop = setTimeout(() => {
      clearTimers()
      setSpinning(false)
    }, SPIN_MS)
  }

  const locked = pending || spinning

  function run(action: () => Promise<Result<HomeState>>, animate: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        if (result.code === 'AUTH_REQUIRED') {
          router.push('/login')
          return
        }
        setError(ERROR_MESSAGES[result.code](result.params))
        return
      }
      setPickId(null)
      if (animate && result.data.kind === 'open') {
        const s = result.data
        playSpin(s.poolNames.length > 0 ? s.poolNames : s.candidates.map((c) => c.name))
      }
      if (!animate && result.data.kind === 'confirmed') setStamping(true)
    })
  }

  const errorBox = error && (
    <p role="alert" className="alert">
      {error}
    </p>
  )

  // 액션이 끝난 직후 새 state 가 조금 늦게 도착할 수 있으므로 state.kind 와 무관하게 메뉴판을 그린다.
  if (spinning) {
    return (
      <section className="section">
        <div className="board" role="status" aria-live="polite">
          <span className="sr-only">후보를 뽑는 중입니다</span>
          <span className="board-name" aria-hidden="true">
            {tickerName}
          </span>
        </div>
      </section>
    )
  }

  if (state.kind === 'no_place') {
    // 홈은 장소가 없으면 /places 로 리다이렉트하므로(스펙 06 F1.2) 보통 도달하지 않는다.
    return <p className="muted">장소를 먼저 등록해 주세요</p>
  }

  if (state.kind === 'outside') {
    return (
      <section className="section">
        <div className="board">
          <p className="board-caption">다음 룰렛은 {state.nextSlotAt}에 열립니다</p>
        </div>
        <button type="button" className="btn btn-primary btn-block" disabled>
          돌리기
        </button>
      </section>
    )
  }

  if (state.kind === 'not_enough') {
    return (
      <section className="section">
        <div className="board">
          <p className="board-caption">지금 영업 중인 식당이 {state.count}곳뿐입니다</p>
        </div>
        <button type="button" className="btn btn-primary btn-block" disabled>
          돌리기
        </button>
      </section>
    )
  }

  if (state.kind === 'idle') {
    return (
      <section className="section">
        <div className="board">
          <p className="board-caption">영업 중인 식당 3곳을 뽑습니다</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={locked}
          onClick={() => run(() => spin(placeId), true)}
        >
          {pending ? '돌리는 중…' : '돌리기'}
        </button>
        {errorBox}
      </section>
    )
  }

  const placeNote = (s: { placeId: string | null; placeName: string }) =>
    s.placeId !== placeId ? (
      <p className="note">오늘 이 슬롯의 룰렛은 이미 &quot;{s.placeName}&quot;에서 돌렸습니다. 슬롯당 룰렛은 한 번입니다.</p>
    ) : null

  if (state.kind === 'confirmed') {
    const c = state.chosen
    return (
      <section className="section">
        {placeNote(state)}
        <div className="result" aria-live="polite">
          <span className={stamping ? 'seal is-stamping' : 'seal'} aria-hidden="true">
            확정
          </span>
          <p className="result-slot">오늘 {state.slotLabel}</p>
          <h2 className="result-name">{c.name}</h2>
          <p className="muted small">{c.address}</p>
          <LevelStamps level={c.level} levelName={c.levelName} nextIn={c.nextIn} />
          {state.leveledUp && <p className="levelup">레벨 업! 이제 {c.levelName}입니다</p>}
        </div>
        <p className="muted">다음 룰렛은 {state.nextSlotAt}에 열립니다</p>
      </section>
    )
  }

  // open
  const picked = pickId ? state.candidates.find((c) => c.id === pickId) : null
  return (
    <section className="section">
      {placeNote(state)}
      <ul className="tickets">
        {state.candidates.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="ticket"
              aria-pressed={pickId === c.id}
              disabled={locked}
              onClick={() => {
                setError(null)
                setPickId(c.id)
              }}
            >
              <span className="ticket-main">
                <span className="ticket-name">{c.name}</span>
                <span className="ticket-address">{c.address}</span>
              </span>
              <span className="ticket-stub">
                <LevelStamps level={c.level} levelName={c.levelName} nextIn={c.nextIn} compact />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {picked && (
        <div className="confirm" role="group" aria-label="확정 확인">
          <p>{picked.name}으로 확정할까요?</p>
          <div className="confirm-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={locked}
              onClick={() => run(() => confirm(state.sessionId, picked.id), false)}
            >
              {pending ? '확정 중…' : '확정'}
            </button>
            <button type="button" className="btn" disabled={locked} onClick={() => setPickId(null)}>
              취소
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn btn-block"
        disabled={locked || state.rerollUsed}
        onClick={() => run(() => reroll(state.sessionId), true)}
      >
        {state.rerollUsed ? '다시 돌리기 (사용함)' : '다시 돌리기'}
      </button>
      {errorBox}
    </section>
  )
}
```

주의: 기존의 `Candidate` import는 쓰지 않으므로 뺐다. `<button>` 안에는 `<div>`를 넣지 않고 `<span>`만 쓴다(유효한 HTML).

- [ ] **Step 3: `src/app/(app)/page.tsx`를 아래 내용으로 바꾼다**

슬롯 문구("오늘 점심")는 상단 행으로 올라간다. `HomeState` 중 `slotLabel`이 있는 종류(not_enough, idle, open, confirmed)에서만 보여 준다.

```tsx
import { redirect } from 'next/navigation'
import { listPlaces } from '@/actions/places'
import { getHomeState } from '@/actions/roulette'
import { ERROR_MESSAGES } from '@/lib/result'
import AdminResetButton from '@/app/components/AdminResetButton'
import PlacePicker from '@/app/components/PlacePicker'
import RouletteBoard from '@/app/components/RouletteBoard'

export const dynamic = 'force-dynamic'

/** S2. 홈(룰렛). 장소 선택 + 서버가 판정한 상태를 그대로 표시한다. */
export default async function Home({ searchParams }: { searchParams: Promise<{ place?: string }> }) {
  const { place } = await searchParams

  const places = await listPlaces()
  if (!places.ok) {
    if (places.code === 'AUTH_REQUIRED') redirect('/login')
    return (
      <>
        <h1 className="page-title">식사 룰렛</h1>
        <p role="alert" className="alert">
          {ERROR_MESSAGES[places.code](places.params)}
        </p>
      </>
    )
  }

  // 스펙 06 F1.2: 장소가 없으면 장소 관리로 보낸다.
  if (places.data.length === 0) redirect('/places')

  const selectedPlaceId = places.data.some((p) => p.id === place) ? (place as string) : places.data[0].id
  const state = await getHomeState(selectedPlaceId)
  if (!state.ok && state.code === 'AUTH_REQUIRED') redirect('/login')

  const slotLabel = state.ok && 'slotLabel' in state.data ? state.data.slotLabel : null

  return (
    <>
      <h1 className="sr-only">식사 룰렛</h1>
      <div className="home-top">
        <PlacePicker places={places.data.map((p) => ({ id: p.id, name: p.name }))} selectedId={selectedPlaceId} />
        {slotLabel && <p className="slot-label">오늘 {slotLabel}</p>}
      </div>
      <AdminResetButton />
      {state.ok ? (
        <RouletteBoard state={state.data} placeId={selectedPlaceId} />
      ) : (
        <p role="alert" className="alert">
          {ERROR_MESSAGES[state.code](state.params)}
        </p>
      )}
    </>
  )
}
```

- [ ] **Step 4: 타입 검사, 린트**

Run: `npx tsc --noEmit; npm run lint`
Expected: 자기 파일 3개에서 오류 0. 다른 세션 파일의 오류는 보고서에 적고 넘어간다.

- [ ] **Step 5: 화면 확인 (개발 서버, 모바일 폭 390px)**

`.env.local`에 `ROULETTE_ALLOW_ANY_TIME=1`이 있으면 시간과 무관하게 돌릴 수 있다(테스트 플래그, 스펙 13 Q4). 없으면 주인님께 켜 달라고 요청하고, 슬롯 밖 화면만 확인한다.

확인 목록:
- 세션 없음: 메뉴판에 "영업 중인 식당 3곳을 뽑습니다", 아래 빨간 돌리기 버튼. 상단에 장소 이름(굵은 표시 서체)과 "오늘 점심".
- 돌리기: 메뉴판에 이름이 빠르게 바뀌다 1.8초 뒤 식권 3장. 오른쪽 절취선 영역에 도장 5칸과 레벨 이름.
- 식권 탭: 빨간 테두리 + "OO으로 확정할까요?" + 확정(빨강)/취소.
- 확정: 큰 식권 위 오른쪽에 빨간 원형 "확정" 도장이 튀어 들어온다. 새로고침하면 도장은 있되 움직임은 없다.
- 레벨 업 시 "레벨 업! 이제 익숙입니다".
- Chrome DevTools > Rendering > Emulate CSS media feature prefers-reduced-motion: reduce 를 켜고 돌리기: 티커 없이 바로 식권 3장. 확정 시 도장이 바로 찍힘.
- Tab 키로 식권 → 확정 → 다시 돌리기 순으로 빨간 포커스 링이 보인다.
- 가로 스크롤이 없다.

- [ ] **Step 6: 커밋**

```bash
git add src/app/components/PlacePicker.tsx src/app/components/RouletteBoard.tsx "src/app/(app)/page.tsx"
git commit -m "feat(ui): 홈을 메뉴판, 식권, 도장으로 다시 그림 (스펙 15)"
```

- [ ] **Step 7: 보고**

바꾼 파일, 커밋 해시, 확인한 화면 목록(위 확인 목록 중 실제로 본 것만), 부족한 클래스, 남의 파일에서 본 오류를 적어 보고한다.
