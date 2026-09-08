import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Supabase 서버 클라이언트 목: code 교환 결과만 제어한다.
const exchangeMock = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: (code: string) => exchangeMock(code) } }),
}))

import { GET } from '@/app/auth/callback/route'

// Docker standalone 서버는 HOSTNAME=0.0.0.0 으로 바인드하고, Next 는 request.nextUrl.origin 을
// Host 헤더가 아니라 그 바인드 주소로 채운다. 그래서 내부 URL 이 0.0.0.0:3000 인 요청으로 재현한다.
const internal = (path: string) =>
  new NextRequest(`http://0.0.0.0:3000${path}`, { headers: { host: 'lunch.rouleat.biz' } })

describe('GET /auth/callback 리디렉션 도착지', () => {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  beforeEach(() => {
    exchangeMock.mockReset()
    process.env.NEXT_PUBLIC_SITE_URL = 'https://lunch.rouleat.biz'
  })
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = env
  })

  it('교환 성공: 공개 주소(NEXT_PUBLIC_SITE_URL)의 홈으로 보낸다. 바인드 주소 0.0.0.0 이 새면 안 된다', async () => {
    exchangeMock.mockResolvedValue({ error: null })
    const res = await GET(internal('/auth/callback?code=ok'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://lunch.rouleat.biz/')
  })

  it('교환 실패: 공개 주소의 /login?error=auth 로 보낸다', async () => {
    exchangeMock.mockResolvedValue({ error: new Error('bad code') })
    const res = await GET(internal('/auth/callback?code=bad'))
    expect(res.headers.get('location')).toBe('https://lunch.rouleat.biz/login?error=auth')
  })

  it('code 없음: 교환을 시도하지 않고 /login?error=auth', async () => {
    const res = await GET(internal('/auth/callback'))
    expect(exchangeMock).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('https://lunch.rouleat.biz/login?error=auth')
  })

  it('NEXT_PUBLIC_SITE_URL 이 없으면(로컬 개발) 요청 origin 을 그대로 쓴다', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    exchangeMock.mockResolvedValue({ error: null })
    const res = await GET(new NextRequest('http://localhost:3000/auth/callback?code=ok'))
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('NEXT_PUBLIC_SITE_URL 끝의 슬래시는 중복되지 않는다', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://lunch.rouleat.biz/'
    exchangeMock.mockResolvedValue({ error: null })
    const res = await GET(internal('/auth/callback?code=ok'))
    expect(res.headers.get('location')).toBe('https://lunch.rouleat.biz/')
  })
})
