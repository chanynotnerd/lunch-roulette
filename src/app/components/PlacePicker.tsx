'use client'

import { useRouter } from 'next/navigation'

type Option = { id: string; name: string }

/** 장소 선택 드롭다운. 바꾸면 /?place=<id>로 이동한다. */
export default function PlacePicker({ places, selectedId }: { places: Option[]; selectedId: string }) {
  const router = useRouter()
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ marginRight: 8 }}>장소</span>
      <select
        value={selectedId}
        onChange={(e) => router.push(`/?place=${encodeURIComponent(e.target.value)}`)}
        style={{ fontSize: 16, padding: 6 }}
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
