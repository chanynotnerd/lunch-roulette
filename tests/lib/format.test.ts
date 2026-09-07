import { describe, expect, it } from 'vitest'
import { formatSlotDate, formatVisitMeta } from '@/lib/format'

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

describe('formatVisitMeta', () => {
  it('방문 횟수와 연도 없는 마지막 방문일을 잇는다', () => {
    expect(formatVisitMeta(7, '2026-09-04')).toBe('7회 방문, 마지막 방문 9월 4일')
  })

  it('월과 일의 앞 0을 뗀다', () => {
    expect(formatVisitMeta(1, '2026-01-09')).toBe('1회 방문, 마지막 방문 1월 9일')
    expect(formatVisitMeta(12, '2026-12-25')).toBe('12회 방문, 마지막 방문 12월 25일')
  })

  it('날짜 형식이 다르면 날짜 부분에 입력을 그대로 쓴다', () => {
    expect(formatVisitMeta(2, '어제')).toBe('2회 방문, 마지막 방문 어제')
  })
})
