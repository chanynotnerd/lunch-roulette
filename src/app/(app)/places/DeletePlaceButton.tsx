'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { deletePlace } from '@/actions/places'
import { ERROR_MESSAGES } from '@/lib/result'

export default function DeletePlaceButton({
  placeId,
  placeName,
}: {
  placeId: string
  placeName: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deletePlace(placeId)
      if (!result.ok) {
        if (result.code === 'AUTH_REQUIRED') {
          router.push('/login')
          return
        }
        setError(ERROR_MESSAGES[result.code](result.params))
        return
      }
      setConfirming(false)
    })
  }

  if (!confirming) {
    return (
      <div style={{ marginTop: 8 }}>
        <button type="button" onClick={() => setConfirming(true)}>
          삭제
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <span>{placeName}을(를) 삭제할까요? </span>
      <button type="button" onClick={onConfirm} disabled={pending}>
        {pending ? '삭제 중…' : '정말 삭제'}
      </button>{' '}
      <button type="button" onClick={() => setConfirming(false)} disabled={pending}>
        취소
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
