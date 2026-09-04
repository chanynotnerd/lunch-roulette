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
