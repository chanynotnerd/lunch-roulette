'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'
import { createPlace } from '@/actions/places'
import { ERROR_MESSAGES } from '@/lib/result'

type Message = { kind: 'error' | 'info' | 'success'; text: string }

export default function PlaceForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<Message | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [radius, setRadius] = useState(500)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await createPlace({ name, address, radiusM: radius })
      if (!result.ok) {
        if (result.code === 'AUTH_REQUIRED') {
          router.push('/login')
          return
        }
        setMessage({ kind: 'error', text: ERROR_MESSAGES[result.code](result.params) })
        return
      }
      if (result.data.restaurantCount === 0) {
        setMessage({ kind: 'info', text: ERROR_MESSAGES.PLACE_NO_RESTAURANTS() })
      } else {
        setMessage({
          kind: 'success',
          text: `장소를 추가했습니다. 식당 ${result.data.restaurantCount}곳을 찾았습니다.`,
        })
      }
      setName('')
      setAddress('')
      setRadius(500)
    })
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <label className="field">
        이름
        <input
          className="input"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={50}
          placeholder="예: 회사"
          disabled={pending}
        />
      </label>
      <label className="field">
        주소
        <input
          className="input"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          placeholder="도로명 주소"
          disabled={pending}
        />
      </label>
      <label className="field">
        반경(m)
        <input
          className="input"
          name="radius"
          type="number"
          min={100}
          max={1000}
          step={50}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          required
          disabled={pending}
        />
      </label>
      <button type="submit" className="btn btn-block" disabled={pending}>
        {pending ? '식당을 찾는 중…' : '장소 추가'}
      </button>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'alert' : 'muted'}>
          {message.text}
        </p>
      )}
    </form>
  )
}
