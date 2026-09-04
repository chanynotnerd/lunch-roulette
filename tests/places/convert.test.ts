import { describe, expect, it } from 'vitest'
import { toHours, type GPeriod } from '@/places/convert'

const p = (
  day: number,
  oh: number,
  om: number,
  ch?: number,
  cm?: number,
  cday?: number,
): GPeriod =>
  ch === undefined
    ? { open: { day, hour: oh, minute: om } }
    : { open: { day, hour: oh, minute: om }, close: { day: cday ?? day, hour: ch, minute: cm ?? 0 } }

describe('toHours', () => {
  it('영업시간 없음 → null', () => {
    expect(toHours(undefined)).toBeNull()
    expect(toHours(null)).toBeNull()
    expect(toHours({})).toBeNull()
    expect(toHours({ periods: [] })).toBeNull()
  })

  it('구간 1개', () => {
    const h = toHours({ periods: [p(1, 11, 0, 21, 0)] })
    expect(h?.mon).toEqual({ open: '11:00', close: '21:00' })
  })

  it('구간 2개 → 브레이크 생성', () => {
    const h = toHours({ periods: [p(1, 11, 0, 15, 0), p(1, 17, 0, 21, 30)] })
    expect(h?.mon).toEqual({
      open: '11:00',
      close: '21:30',
      break: { start: '15:00', end: '17:00' },
    })
  })

  it('구간 3개 → 첫 공백만 브레이크', () => {
    const h = toHours({
      periods: [p(2, 9, 0, 11, 0), p(2, 12, 0, 15, 0), p(2, 17, 0, 22, 0)],
    })
    expect(h?.tue).toEqual({
      open: '09:00',
      close: '22:00',
      break: { start: '11:00', end: '12:00' },
    })
  })

  it('정렬되지 않은 구간도 시작 시각 순으로 처리', () => {
    const h = toHours({ periods: [p(1, 17, 0, 21, 0), p(1, 11, 0, 15, 0)] })
    expect(h?.mon).toEqual({
      open: '11:00',
      close: '21:00',
      break: { start: '15:00', end: '17:00' },
    })
  })

  it('요일 누락 → 휴무', () => {
    const h = toHours({ periods: [p(1, 11, 0, 21, 0)] })
    expect(h?.sun).toEqual({ closed: true })
    expect(h?.tue).toEqual({ closed: true })
    expect(h?.sat).toEqual({ closed: true })
  })

  it('Google 요일 매핑: 0=일 … 6=토', () => {
    const h = toHours({ periods: [p(0, 10, 0, 20, 0), p(6, 12, 30, 23, 45)] })
    expect(h?.sun).toEqual({ open: '10:00', close: '20:00' })
    expect(h?.sat).toEqual({ open: '12:30', close: '23:45' })
  })

  it('24시간 영업 → 모든 요일 00:00~24:00', () => {
    const h = toHours({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] })
    expect(h).not.toBeNull()
    for (const key of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const) {
      expect(h?.[key]).toEqual({ open: '00:00', close: '24:00' })
    }
  })

  it('자정 넘김: 금 22:00 → 토 02:00', () => {
    const h = toHours({ periods: [p(5, 22, 0, 2, 0, 6)] })
    expect(h?.fri).toEqual({ open: '22:00', close: '02:00' })
    expect(h?.sat).toEqual({ closed: true })
  })

  it('자정 넘김 구간이 첫 구간이면 브레이크를 만들지 않음', () => {
    const h = toHours({ periods: [p(5, 22, 0, 2, 0, 6), p(5, 23, 30, 23, 45)] })
    expect(h?.fri).not.toHaveProperty('break')
  })

  it('close 없는 구간은 24:00 종료', () => {
    const h = toHours({ periods: [p(3, 18, 0), p(1, 9, 0, 17, 0)] })
    expect(h?.wed).toEqual({ open: '18:00', close: '24:00' })
  })
})
