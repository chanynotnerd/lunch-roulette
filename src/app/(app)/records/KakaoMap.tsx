'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { InitialView, MapMarker, PlaceMarker } from '@/actions/records-types'
import type { KakaoMapInstance, KakaoOverlay } from '@/types/kakao-maps'
import { placeMarkerHtml, stampMarkerHtml } from './stamp-marker'

/**
 * 카카오맵 SDK 로드, 지도 생성, 초기 범위, 마커 그리기. 스펙 16 KakaoMap.
 * SDK는 autoload=false로 넣고 kakao.maps.load 콜백 안에서만 지도를 만든다.
 * 카카오 객체는 이 파일 밖으로 나가지 않는다. 실패는 브라우저 상태이며 console.error만 남긴다.
 */

const SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js'
const INIT_TIMEOUT_MS = 10_000
const BOUNDS_PADDING = 48
const SELECTED_Z = 100
/** 장소 마커는 도장 마커(1~9, 선택 100)보다 아래. */
const PLACE_Z = 0

export type PanTarget = { id: string; nonce: number }

type Props = {
  jsKey: string | null
  markers: MapMarker[]
  /** 사용자의 장소. 검은 점 + 이름 라벨. 누를 수 없다. */
  places: PlaceMarker[]
  selectedId: string | null
  initialView: InitialView
  panTarget: PanTarget | null
  onSelect: (id: string) => void
  onDeselect: () => void
}

type Status = 'loading' | 'ready' | 'failed'

export default function KakaoMap({ jsKey, markers, places, selectedId, initialView, panTarget, onSelect, onDeselect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMapInstance | null>(null)
  const overlaysRef = useRef<KakaoOverlay[]>([])
  const placeOverlaysRef = useRef<KakaoOverlay[]>([])
  const [status, setStatus] = useState<Status>(jsKey ? 'loading' : 'failed')

  // 지도 이벤트 리스너는 한 번만 등록하므로 최신 콜백을 ref로 본다.
  // 렌더 중 ref 갱신은 react-hooks/refs 규칙에 걸려 effect 안에서 갱신한다.
  const onSelectRef = useRef(onSelect)
  const onDeselectRef = useRef(onDeselect)
  useEffect(() => {
    onSelectRef.current = onSelect
    onDeselectRef.current = onDeselect
  }, [onSelect, onDeselect])

  // 초기 범위는 처음 한 번만 쓴다. 이후 prop이 바뀌어도 지도를 다시 맞추지 않는다.
  const initialViewRef = useRef(initialView)

  const init = useCallback(() => {
    const maps = window.kakao?.maps
    if (!maps || !containerRef.current || mapRef.current) return
    maps.load(() => {
      const el = containerRef.current
      if (!el || mapRef.current) return
      const view = initialViewRef.current
      const first = view.kind === 'center' ? view.center : view.points[0]
      const map = new maps.Map(el, {
        center: new maps.LatLng(first.lat, first.lng),
        level: view.kind === 'center' ? view.zoom : 4,
      })
      if (view.kind === 'bounds') {
        const bounds = new maps.LatLngBounds()
        for (const p of view.points) bounds.extend(new maps.LatLng(p.lat, p.lng))
        map.setBounds(bounds, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING)
      }
      maps.event.addListener(map, 'click', () => onDeselectRef.current())
      mapRef.current = map
      setStatus('ready')
    })
  }, [])

  // 이미 로드된 SDK(같은 탭에서 다시 진입)면 스크립트 onLoad가 안 오므로 여기서 초기화한다. 10초 안에 지도가 없으면 실패.
  useEffect(() => {
    if (!jsKey) return
    if (window.kakao?.maps) init()
    const timer = window.setTimeout(() => {
      if (mapRef.current) return
      console.error('[KakaoMap] 지도 초기화 시간 초과')
      setStatus('failed')
    }, INIT_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [jsKey, init])

  // 마커 갱신: 목록이나 선택이 바뀌면 전부 지우고 다시 그린다. 수십 개 수준이라 충분하다.
  useEffect(() => {
    const maps = window.kakao?.maps
    const map = mapRef.current
    if (status !== 'ready' || !maps || !map) return
    for (const o of overlaysRef.current) o.setMap(null)
    overlaysRef.current = markers.map((m) => {
      const selected = m.restaurantId === selectedId
      const wrap = document.createElement('div')
      wrap.innerHTML = stampMarkerHtml({
        visits: m.visits,
        level: m.level,
        name: m.name,
        levelName: m.levelName,
        selected,
      })
      const button = wrap.firstElementChild as HTMLElement
      button.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelectRef.current(m.restaurantId)
      })
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(m.lat, m.lng),
        content: button,
        xAnchor: 0.5,
        yAnchor: 0.5,
        clickable: true,
        // 선택된 것이 가장 위, 그다음은 레벨이 낮을수록 위(큰 도장이 작은 도장을 덮지 않게).
        zIndex: selected ? SELECTED_Z : 10 - m.level,
      })
      overlay.setMap(map)
      return overlay
    })
  }, [status, markers, selectedId])

  // 장소 마커: 지도가 준비되면 그린다. 누를 수 없고(clickable: false) 탭은 지도로 통과한다.
  useEffect(() => {
    const maps = window.kakao?.maps
    const map = mapRef.current
    if (status !== 'ready' || !maps || !map) return
    for (const o of placeOverlaysRef.current) o.setMap(null)
    placeOverlaysRef.current = places.map((p) => {
      const wrap = document.createElement('div')
      wrap.innerHTML = placeMarkerHtml({ name: p.name })
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(p.lat, p.lng),
        content: wrap.firstElementChild as HTMLElement,
        xAnchor: 0,
        yAnchor: 0.5,
        clickable: false,
        zIndex: PLACE_Z,
      })
      overlay.setMap(map)
      return overlay
    })
  }, [status, places])

  // 목록에서 항목을 고르면 그 마커로 이동.
  useEffect(() => {
    const maps = window.kakao?.maps
    const map = mapRef.current
    if (!panTarget || status !== 'ready' || !maps || !map) return
    const m = markers.find((x) => x.restaurantId === panTarget.id)
    if (m) map.panTo(new maps.LatLng(m.lat, m.lng))
  }, [panTarget, status, markers])

  return (
    <>
      {jsKey && (
        <Script
          src={`${SDK_URL}?appkey=${encodeURIComponent(jsKey)}&autoload=false`}
          strategy="afterInteractive"
          onLoad={init}
          onError={() => {
            console.error('[KakaoMap] SDK 스크립트 로드 실패')
            setStatus('failed')
          }}
        />
      )}
      <div ref={containerRef} className="map-canvas" role="region" aria-label="다녀온 식당 지도" />
      {status === 'loading' && (
        <p className="map-loading" aria-live="polite">
          지도를 불러오는 중
        </p>
      )}
      {status === 'failed' && (
        <p className="map-box map-fail" role="status">
          지도를 표시할 수 없습니다. 목록으로 볼 수 있습니다
        </p>
      )}
    </>
  )
}
