import { afterEach, describe, expect, it, vi } from 'vitest'

// server-only 는 RSC 밖에서 import 하면 던진다. 순수 함수만 검사하므로 빈 모듈로 바꾼다.
vi.mock('server-only', () => ({}))

import { isAdminEmail } from '@/lib/admin'

describe('isAdminEmail', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ADMIN_EMAILS 미설정이면 아무도 관리자가 아니다', () => {
    vi.stubEnv('ADMIN_EMAILS', '')
    expect(isAdminEmail('a@b.com')).toBe(false)
  })

  it('쉼표 구분 목록에 있으면 true, 없으면 false', () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@b.com,other@b.com')
    expect(isAdminEmail('admin@b.com')).toBe(true)
    expect(isAdminEmail('other@b.com')).toBe(true)
    expect(isAdminEmail('nobody@b.com')).toBe(false)
  })

  it('공백과 대소문자를 무시한다', () => {
    vi.stubEnv('ADMIN_EMAILS', ' Admin@B.com , , other@b.com ')
    expect(isAdminEmail('ADMIN@b.COM')).toBe(true)
    expect(isAdminEmail('  other@b.com ')).toBe(true)
  })

  it('이메일이 없으면 false', () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@b.com')
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })

  it('빈 항목만 있는 목록에 빈 문자열이 매칭되지 않는다', () => {
    vi.stubEnv('ADMIN_EMAILS', ' , ,')
    expect(isAdminEmail('a@b.com')).toBe(false)
  })
})
