import { describe, expect, it } from 'vitest'
import { formatSlotDate } from '@/lib/format'

describe('formatSlotDate', () => {
  it('YYYY-MM-DD를 "YYYY년 M월 D일"로 바꾼다', () => {
    expect(formatSlotDate('2026-09-04')).toBe('2026년 9월 4일')
  })

  it('두 자리 월과 일은 앞 0을 뗀다', () => {
    expect(formatSlotDate('2026-12-25')).toBe('2026년 12월 25일')
    expect(formatSlotDate('2026-01-01')).toBe('2026년 1월 1일')
  })

  it('형식이 다르면 입력을 그대로 돌려준다', () => {
    expect(formatSlotDate('2026/09/04')).toBe('2026/09/04')
    expect(formatSlotDate('')).toBe('')
  })
})
