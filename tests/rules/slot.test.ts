import { describe, it, expect, vi, afterEach } from 'vitest'
import { getSlot, nextSlotStart, isSlotEnded, isAnyTimeMode } from '@/rules/slot'

const at = (hhmm: string, date = '2026-09-04') => new Date(`${date}T${hhmm}:00+09:00`)

describe('getSlot', () => {
  it.each([
    ['10:59', null],
    ['11:00', 'lunch'],
    ['14:59', 'lunch'],
    ['15:00', null],
    ['16:59', null],
    ['17:00', 'dinner'],
    ['20:59', 'dinner'],
    ['21:00', null],
    ['00:00', null],
    ['23:59', null],
  ] as const)('%s → %s', (hhmm, slot) => {
    const r = getSlot(at(hhmm))
    if (slot === null) expect(r).toBeNull()
    else expect(r).toEqual({ slot, slotDate: '2026-09-04' })
  })

  it('slotDate follows the Seoul date, not UTC', () => {
    // 2026-09-04T02:30Z == 11:30+09:00 same day; 2026-09-04T09:00Z == 18:00+09:00
    expect(getSlot(new Date('2026-09-04T02:30:00Z'))).toEqual({ slot: 'lunch', slotDate: '2026-09-04' })
    expect(getSlot(new Date('2026-09-04T09:00:00Z'))).toEqual({ slot: 'dinner', slotDate: '2026-09-04' })
  })
})

describe('nextSlotStart', () => {
  it.each([
    ['09:00', '11:00'],
    ['10:59', '11:00'],
    ['11:00', '11:00'],
    ['12:30', '11:00'],
    ['15:00', '17:00'],
    ['15:30', '17:00'],
    ['17:00', '17:00'],
    ['19:00', '17:00'],
    ['21:00', '11:00'],
    ['21:30', '11:00'],
    ['23:59', '11:00'],
    ['00:00', '11:00'],
  ])('%s → %s', (hhmm, expected) => {
    expect(nextSlotStart(at(hhmm))).toBe(expected)
  })
})

describe('isSlotEnded', () => {
  it('lunch is not ended at 14:59 on the same date', () => {
    expect(isSlotEnded('lunch', '2026-09-04', at('14:59'))).toBe(false)
  })
  it('lunch is ended at exactly 15:00 on the same date', () => {
    expect(isSlotEnded('lunch', '2026-09-04', at('15:00'))).toBe(true)
  })
  it('dinner is not ended at 20:59, ended at 21:00', () => {
    expect(isSlotEnded('dinner', '2026-09-04', at('20:59'))).toBe(false)
    expect(isSlotEnded('dinner', '2026-09-04', at('21:00'))).toBe(true)
  })
  it('any slot is ended once the Seoul date has moved past slotDate', () => {
    expect(isSlotEnded('dinner', '2026-09-04', at('00:01', '2026-09-05'))).toBe(true)
    expect(isSlotEnded('lunch', '2026-09-04', at('09:00', '2026-09-05'))).toBe(true)
  })
  it('a slot on a future date is not ended', () => {
    expect(isSlotEnded('lunch', '2026-09-05', at('23:59', '2026-09-04'))).toBe(false)
  })
})

describe('isAnyTimeMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('flag on + non-production → true', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ROULETTE_ALLOW_ANY_TIME', 'true')
    expect(isAnyTimeMode()).toBe(true)
  })

  it('flag on + production → true (플래그는 서버 환경변수라 우회 불가. 운영 배포에는 넣지 않는다)', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ROULETTE_ALLOW_ANY_TIME', 'true')
    expect(isAnyTimeMode()).toBe(true)
    expect(getSlot(at('09:00'))?.slot).toBe('lunch')
  })

  it('flag off → false', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ROULETTE_ALLOW_ANY_TIME', 'false')
    expect(isAnyTimeMode()).toBe(false)
    vi.stubEnv('ROULETTE_ALLOW_ANY_TIME', '')
    expect(isAnyTimeMode()).toBe(false)
  })

  it('flag on + non-production fills the day with two slots', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('ROULETTE_ALLOW_ANY_TIME', 'true')
    expect(getSlot(at('09:00'))).toEqual({ slot: 'lunch', slotDate: '2026-09-04' })
    expect(getSlot(at('23:00'))).toEqual({ slot: 'dinner', slotDate: '2026-09-04' })
  })
})
