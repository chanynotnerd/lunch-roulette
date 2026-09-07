import { describe, expect, it, vi } from 'vitest'

// server-only 는 RSC 밖에서 import 하면 던진다. 순수 함수만 검사하므로 빈 모듈로 바꾼다.
vi.mock('server-only', () => ({}))
// loadProfile이 import하는 서버 클라이언트는 next/headers에 기대므로 테스트에서는 비워 둔다.
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { toProfile } from '@/lib/profile'

describe('toProfile', () => {
  it('full_name과 avatar_url이 있으면 그대로 쓴다', () => {
    const p = toProfile({
      email: 'chanyoung@gmail.com',
      user_metadata: {
        full_name: '김찬영',
        name: '찬영',
        avatar_url: 'https://lh3.googleusercontent.com/a/full',
        picture: 'https://lh3.googleusercontent.com/a/pic',
      },
    })
    expect(p).toEqual({
      name: '김찬영',
      email: 'chanyoung@gmail.com',
      avatarUrl: 'https://lh3.googleusercontent.com/a/full',
      initial: '김',
    })
  })

  it('full_name이 없으면 name을, avatar_url이 없으면 picture를 쓴다', () => {
    const p = toProfile({
      email: 'a@b.com',
      user_metadata: { name: '찬영', picture: 'https://lh3.googleusercontent.com/a/pic' },
    })
    expect(p.name).toBe('찬영')
    expect(p.avatarUrl).toBe('https://lh3.googleusercontent.com/a/pic')
    expect(p.initial).toBe('찬')
  })

  it('이름 키가 없으면 이메일의 @ 앞부분을 이름으로 쓴다', () => {
    const p = toProfile({ email: 'boltwriter721@gmail.com', user_metadata: {} })
    expect(p.name).toBe('boltwriter721')
    expect(p.initial).toBe('b')
    expect(p.avatarUrl).toBeNull()
  })

  it('이름도 이메일도 없으면 "사용자"이고 사진은 null이다', () => {
    const p = toProfile({ email: null, user_metadata: null })
    expect(p).toEqual({ name: '사용자', email: null, avatarUrl: null, initial: '사' })
  })

  it('공백만 있는 이름과 빈 문자열 사진은 없는 것으로 본다', () => {
    const p = toProfile({
      email: 'x@y.com',
      user_metadata: { full_name: '   ', name: '', avatar_url: '', picture: '  ' },
    })
    expect(p.name).toBe('x')
    expect(p.avatarUrl).toBeNull()
  })

  it('user_metadata의 email이 있고 최상위 email이 없으면 그것을 쓴다', () => {
    const p = toProfile({ user_metadata: { email: 'meta@y.com' } })
    expect(p.email).toBe('meta@y.com')
    expect(p.name).toBe('meta')
  })
})
