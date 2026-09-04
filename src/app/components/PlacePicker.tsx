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
