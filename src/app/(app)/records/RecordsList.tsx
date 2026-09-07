'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import type { RecordRow } from '@/actions/records-types'
import LevelStamps from '@/app/components/LevelStamps'
import { formatSlotDate } from '@/lib/format'

type Props = {
  records: RecordRow[]
  onPick: (restaurantId: string) => void
  /** 관리자 초기화 버튼(서버 컴포넌트). 페이지가 만들어 넘긴다. */
  adminSlot?: ReactNode
}

/** 날짜별 기록 목록 오버레이. 스펙 07 S4, 15 식권 더미, 16 M2. 플로팅 버튼이 닫기 역할이므로 aria-modal은 두지 않는다. */
export default function RecordsList({ records, onPick, adminSlot }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  return (
    <section className="map-sheet" role="dialog" aria-labelledby="records-title">
      <h1 id="records-title" ref={titleRef} tabIndex={-1} className="page-title">
        기록
      </h1>
      {adminSlot}
      {records.length === 0 ? (
        <p className="muted">아직 기록이 없습니다. 홈에서 룰렛을 돌리면 여기에 쌓입니다</p>
      ) : (
        <ul className="stubs">
          {records.map((r) => (
            <li key={`${r.slotDate}-${r.slot}`} className="stub">
              <button type="button" className="stub-pick" onClick={() => onPick(r.restaurantId)}>
                <span className="stub-meta">
                  {formatSlotDate(r.slotDate)} {r.slotLabel}, {r.placeName}
                </span>
                <span className="stub-name">{r.restaurantName}</span>
                <LevelStamps level={r.levelAtThatTime} levelName={r.levelName} nextIn={null} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
