'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { confirm, reroll, spin, type Candidate, type HomeState } from '@/actions/roulette'
import { ERROR_MESSAGES, type Result } from '@/lib/result'

const SPIN_MS = 1800
const TICK_MS = 80

function Badge({ c }: { c: Candidate }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        background: '#eef',
        fontSize: 13,
      }}
    >
      Lv{c.level} {c.levelName}
    </span>
  )
}

const buttonStyle: React.CSSProperties = {
  fontSize: 16,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #888',
  background: '#fff',
  cursor: 'pointer',
}

/** 룰렛 영역. 상태 판단은 서버 응답을 그대로 따른다. 스펙 07 S2. */
export default function RouletteBoard({ state, placeId }: { state: HomeState; placeId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [pickId, setPickId] = useState<string | null>(null)

  // 애니메이션: 세션 + 후보 조합이 바뀔 때만 재생한다.
  const animKey = state.kind === 'open' ? `${state.sessionId}:${state.candidates.map((c) => c.id).join(',')}` : null
  const playedKey = useRef<string | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [tickerName, setTickerName] = useState('')

  useEffect(() => {
    if (!animKey || state.kind !== 'open' || playedKey.current === animKey) return
    playedKey.current = animKey
    const names = state.poolNames.length > 0 ? state.poolNames : state.candidates.map((c) => c.name)
    let i = 0
    setSpinning(true)
    setTickerName(names[0] ?? '')
    const interval = setInterval(() => {
      i = (i + 1) % names.length
      setTickerName(names[i] ?? '')
    }, TICK_MS)
    const stop = setTimeout(() => {
      clearInterval(interval)
      setSpinning(false)
    }, SPIN_MS)
    return () => {
      clearInterval(interval)
      clearTimeout(stop)
    }
  }, [animKey, state])

  const locked = pending || spinning

  function run(action: () => Promise<Result<HomeState>>) {
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
      router.refresh()
    })
  }

  const errorBox = error && (
    <p role="alert" style={{ color: '#b00020' }}>
      {error}
    </p>
  )

  if (state.kind === 'no_place') {
    return <p>장소를 먼저 등록해 주세요</p>
  }

  if (state.kind === 'outside') {
    return (
      <section>
        <p>다음 룰렛은 {state.nextSlotAt}에 열립니다</p>
        <button type="button" style={buttonStyle} disabled>
          돌리기
        </button>
      </section>
    )
  }

  if (state.kind === 'not_enough') {
    return (
      <section>
        <p>오늘 {state.slotLabel}</p>
        <p>지금 영업 중인 식당이 {state.count}곳뿐입니다</p>
        <button type="button" style={buttonStyle} disabled>
          돌리기
        </button>
      </section>
    )
  }

  if (state.kind === 'idle') {
    return (
      <section>
        <p>오늘 {state.slotLabel}</p>
        <button type="button" style={buttonStyle} disabled={locked} onClick={() => run(() => spin(placeId))}>
          {pending ? '돌리는 중…' : '돌리기'}
        </button>
        {errorBox}
      </section>
    )
  }

  if (state.kind === 'confirmed') {
    const c = state.chosen
    return (
      <section>
        <h2 style={{ margin: '8px 0' }}>
          오늘 {state.slotLabel}: {c.name}
        </h2>
        <p style={{ color: '#666', margin: '4px 0' }}>{c.address}</p>
        <p>
          <Badge c={c} />
          {c.nextIn !== null && <span style={{ marginLeft: 8, fontSize: 13 }}>다음 레벨까지 {c.nextIn}회</span>}
        </p>
        {state.leveledUp && <p style={{ fontWeight: 'bold', fontSize: 18 }}>레벨 업!</p>}
        <p>다음 룰렛은 {state.nextSlotAt}에 열립니다</p>
      </section>
    )
  }

  // open
  const picked = pickId ? state.candidates.find((c) => c.id === pickId) : null
  return (
    <section>
      <p>오늘 {state.slotLabel}</p>
      {spinning ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 'bold',
            border: '1px solid #ccc',
            borderRadius: 8,
            minHeight: 80,
          }}
        >
          {tickerName}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {state.candidates.map((c) => (
            <li key={c.id} style={{ marginBottom: 8 }}>
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  setError(null)
                  setPickId(c.id)
                }}
                style={{
                  ...buttonStyle,
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: 12,
                  borderColor: pickId === c.id ? '#333' : '#ccc',
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                <div style={{ color: '#666', fontSize: 14 }}>{c.address}</div>
                <div style={{ marginTop: 4 }}>
                  <Badge c={c} />
                  {c.nextIn !== null && <span style={{ marginLeft: 8, fontSize: 13 }}>다음 레벨까지 {c.nextIn}회</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && !spinning && (
        <div style={{ margin: '12px 0', padding: 12, border: '1px solid #333', borderRadius: 8 }}>
          <p style={{ marginTop: 0 }}>{picked.name}으로 확정할까요?</p>
          <button
            type="button"
            style={buttonStyle}
            disabled={locked}
            onClick={() => run(() => confirm(state.sessionId, picked.id))}
          >
            {pending ? '확정 중…' : '확정'}
          </button>{' '}
          <button type="button" style={buttonStyle} disabled={locked} onClick={() => setPickId(null)}>
            취소
          </button>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          style={buttonStyle}
          disabled={locked || state.rerollUsed}
          onClick={() => run(() => reroll(state.sessionId))}
        >
          다시 돌리기{state.rerollUsed ? ' (사용함)' : ''}
        </button>
      </div>
      {errorBox}
    </section>
  )
}
