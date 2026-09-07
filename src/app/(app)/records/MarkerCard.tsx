import type { MapMarker } from '@/actions/records-types'
import LevelStamps from '@/app/components/LevelStamps'
import { formatVisitMeta } from '@/lib/format'

/** 선택된 마커의 식권 카드. 스펙 16 M3. 닫기 버튼은 없다(지도 빈 곳 탭 또는 Esc). */
export default function MarkerCard({ marker }: { marker: MapMarker }) {
  return (
    <div className="map-box map-ticket" role="status">
      <div className="ticket-main">
        <p className="ticket-name">{marker.name}</p>
        <p className="ticket-address">{marker.address}</p>
        <p className="small">{formatVisitMeta(marker.visits, marker.lastVisitDate)}</p>
      </div>
      <div className="ticket-stub">
        <LevelStamps level={marker.level} levelName={marker.levelName} nextIn={null} compact />
      </div>
    </div>
  )
}
