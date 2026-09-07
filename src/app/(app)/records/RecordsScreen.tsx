'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RecordsScreenData } from '@/actions/records-types'
import KakaoMap, { type PanTarget } from './KakaoMap'
import MarkerCard from './MarkerCard'
import RecordsList from './RecordsList'
import { initialView } from './initial-view'

type Props = {
  data: RecordsScreenData
  kakaoJsKey: string | null
  adminSlot?: ReactNode
}

/**
 * 기록 탭 = 전체 화면 지도 + 플로팅 버튼 + 식권 카드 + 목록 오버레이. 스펙 16 화면 구성.
 * 상태는 두 개뿐: 선택된 식당 id, 목록 열림 여부. 지도 이동 요청은 panTarget으로 KakaoMap에 전달한다.
 */
export default function RecordsScreen({ data, kakaoJsKey, adminSlot }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [panTarget, setPanTarget] = useState<PanTarget | null>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  const view = useMemo(() => initialView(data.markers, data.fallbackCenter), [data.markers, data.fallbackCenter])
  const selected = data.markers.find((m) => m.restaurantId === selectedId) ?? null

  const closeList = useCallback(() => {
    setListOpen(false)
    // 오버레이가 사라진 뒤 플로팅 버튼으로 포커스 복귀 (스펙 16 접근성)
    requestAnimationFrame(() => fabRef.current?.focus())
  }, [])

  // Esc: 목록이 열려 있으면 목록을, 아니면 카드를 닫는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (listOpen) closeList()
      else if (selectedId) setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listOpen, selectedId, closeList])

  // 목록 항목 탭: 목록 닫고 그 식당 선택, 지도를 그 마커로 이동. 마커가 없는 식당(좌표 없음)이면 닫기만.
  const pick = (restaurantId: string) => {
    closeList()
    if (!data.markers.some((m) => m.restaurantId === restaurantId)) return
    setSelectedId(restaurantId)
    setPanTarget((prev) => ({ id: restaurantId, nonce: (prev?.nonce ?? 0) + 1 }))
  }

  return (
    <div className="map-screen">
      <KakaoMap
        jsKey={kakaoJsKey}
        markers={data.markers}
        selectedId={selectedId}
        initialView={view}
        panTarget={panTarget}
        onSelect={setSelectedId}
        onDeselect={() => setSelectedId(null)}
      />
      {data.markers.length === 0 && !listOpen && (
        <p className="map-box map-notice">아직 기록이 없습니다. 홈에서 룰렛을 돌리면 여기에 쌓입니다</p>
      )}
      {selected && !listOpen && <MarkerCard marker={selected} />}
      {listOpen && <RecordsList records={data.records} onPick={pick} adminSlot={adminSlot} />}
      <button
        ref={fabRef}
        type="button"
        className="map-box map-fab"
        aria-label={listOpen ? '지도로 돌아가기' : '기록 목록 보기'}
        aria-expanded={listOpen}
        onClick={() => (listOpen ? closeList() : setListOpen(true))}
      >
        {listOpen ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
    </div>
  )
}
