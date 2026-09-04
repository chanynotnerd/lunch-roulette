import { describe, it, expect } from 'vitest'
import { isOpenAt } from '@/rules/hours'
import { DAY_KEYS, type DayHours, type Hours } from '@/rules/types'

// 2026-09-04 = fri, 2026-09-05 = sat
const at = (hhmm: string, date = '2026-09-04') => new Date(`${date}T${hhmm}:00+09:00`)

function everyDay(day: DayHours): Hours {
  return Object.fromEntries(DAY_KEYS.map((k) => [k, day])) as Hours
}

const regular = everyDay({ open: '11:00', close: '21:00' })
const withBreak = everyDay({ open: '11:00', close: '21:00', break: { start: '15:00', end: '17:00' } })

describe('isOpenAt', () => {
  it('null hours is never open', () => {
    expect(isOpenAt(null, at('12:00'))).toBe(false)
  })

  it('closed day is not open', () => {
    const hours: Hours = { ...regular, fri: { closed: true } }
    expect(isOpenAt(hours, at('12:00'))).toBe(false)
    // other days unaffected
    expect(isOpenAt(hours, at('12:00', '2026-09-05'))).toBe(true)
  })

  it('exactly open time is included', () => {
    expect(isOpenAt(regular, at('11:00'))).toBe(true)
    expect(isOpenAt(regular, at('10:59'))).toBe(false)
  })

  it('exactly close time is excluded', () => {
    expect(isOpenAt(regular, at('20:59'))).toBe(true)
    expect(isOpenAt(regular, at('21:00'))).toBe(false)
  })

  it('break start is excluded, break end is included', () => {
    expect(isOpenAt(withBreak, at('14:59'))).toBe(true)
    expect(isOpenAt(withBreak, at('15:00'))).toBe(false)
    expect(isOpenAt(withBreak, at('16:59'))).toBe(false)
    expect(isOpenAt(withBreak, at('17:00'))).toBe(true)
  })

  describe('overnight (fri 17:00-02:00)', () => {
    const overnight: Hours = {
      ...everyDay({ closed: true }),
      fri: { open: '17:00', close: '02:00' },
    }

    it('open late on friday itself', () => {
      expect(isOpenAt(overnight, at('16:59'))).toBe(false)
      expect(isOpenAt(overnight, at('17:00'))).toBe(true)
      expect(isOpenAt(overnight, at('23:59'))).toBe(true)
    })

    it('sat 01:30 is open as extension of friday', () => {
      expect(isOpenAt(overnight, at('01:30', '2026-09-05'))).toBe(true)
      expect(isOpenAt(overnight, at('00:00', '2026-09-05'))).toBe(true)
    })

    it('sat 02:00 is closed when saturday has no hours of its own', () => {
      expect(isOpenAt(overnight, at('02:00', '2026-09-05'))).toBe(false)
    })

    it('sat 02:00 is open if saturday has its own hours covering it', () => {
      const hours: Hours = { ...overnight, sat: { open: '02:00', close: '10:00' } }
      expect(isOpenAt(hours, at('02:00', '2026-09-05'))).toBe(true)
    })

    it('yesterday break is ignored during the overnight extension', () => {
      const hours: Hours = {
        ...overnight,
        fri: { open: '17:00', close: '02:00', break: { start: '00:30', end: '01:00' } },
      }
      expect(isOpenAt(hours, at('00:45', '2026-09-05'))).toBe(true)
    })

    it('today closed but yesterday overnight still counts', () => {
      const hours: Hours = { ...overnight, sat: { closed: true } }
      expect(isOpenAt(hours, at('01:00', '2026-09-05'))).toBe(true)
    })

    it('a normal (non-overnight) yesterday does not extend into today', () => {
      const hours: Hours = { ...everyDay({ closed: true }), fri: { open: '11:00', close: '21:00' } }
      expect(isOpenAt(hours, at('01:00', '2026-09-05'))).toBe(false)
    })

    it('mon early morning uses sun as yesterday', () => {
      const hours: Hours = { ...everyDay({ closed: true }), sun: { open: '18:00', close: '03:00' } }
      // 2026-09-07 is Monday
      expect(isOpenAt(hours, at('02:00', '2026-09-07'))).toBe(true)
      expect(isOpenAt(hours, at('03:00', '2026-09-07'))).toBe(false)
    })
  })

  it('24h "00:00"-"24:00" is open at 03:00 and 23:59', () => {
    const allDay = everyDay({ open: '00:00', close: '24:00' })
    expect(isOpenAt(allDay, at('03:00'))).toBe(true)
    expect(isOpenAt(allDay, at('00:00'))).toBe(true)
    expect(isOpenAt(allDay, at('23:59'))).toBe(true)
  })

  it('uses the Seoul weekday, not UTC', () => {
    // 2026-09-04T16:00Z == sat 01:00 KST. Only sat open 00:00-05:00.
    const hours: Hours = { ...everyDay({ closed: true }), sat: { open: '00:00', close: '05:00' } }
    expect(isOpenAt(hours, new Date('2026-09-04T16:00:00Z'))).toBe(true)
  })

  describe('robustness (R1, S2)', () => {
    it('{closed:false, open, close} is treated as a normal open day', () => {
      const hours = {
        ...everyDay({ closed: true }),
        fri: { closed: false, open: '11:00', close: '21:00' },
      } as unknown as Hours
      expect(isOpenAt(hours, at('12:00'))).toBe(true)
      expect(isOpenAt(hours, at('22:00'))).toBe(false)
    })

    it('{closed:false} without open/close is not open', () => {
      const hours = { ...regular, fri: { closed: false } } as unknown as Hours
      expect(isOpenAt(hours, at('12:00'))).toBe(false)
    })

    it.each([
      ['empty object', {}],
      ['array', []],
      ['string', 'mon'],
      ['number weekday', { ...regular, fri: 5 }],
      ['null weekday', { ...regular, fri: null }],
      ['missing weekday', { ...regular, fri: undefined }],
      ['open 25:00', { ...regular, fri: { open: '25:00', close: '21:00' } }],
      ['open number', { ...regular, fri: { open: 660, close: '21:00' } }],
      ['open missing', { ...regular, fri: { close: '21:00' } }],
      ['break not object', { ...regular, fri: { open: '11:00', close: '21:00', break: '15:00-17:00' } }],
      ['break.end malformed', { ...regular, fri: { open: '11:00', close: '21:00', break: { start: '15:00', end: '17' } } }],
    ])('malformed hours (%s) → false without throwing', (_name, hours) => {
      expect(() => isOpenAt(hours as unknown as Hours, at('12:00'))).not.toThrow()
      expect(isOpenAt(hours as unknown as Hours, at('12:00'))).toBe(false)
    })

    it('runtime still accepts legacy "24:30"-style close (pre-0005 seed allowed it)', () => {
      // 시드 검증(validateHours)은 24:01~24:59 를 거부하지만, 이미 저장된 행의 판정은 바뀌면 안 된다.
      const hours = { ...regular, fri: { open: '11:00', close: '24:30' } } as unknown as Hours
      expect(isOpenAt(hours, at('23:30'))).toBe(true)
      expect(isOpenAt(hours, at('12:00'))).toBe(true)
    })

    it('malformed yesterday entry does not throw and does not extend into today', () => {
      const hours = { ...everyDay({ closed: true }), fri: { open: '17:00', close: 'late' } } as unknown as Hours
      expect(() => isOpenAt(hours, at('01:00', '2026-09-05'))).not.toThrow()
      expect(isOpenAt(hours, at('01:00', '2026-09-05'))).toBe(false)
    })
  })
})
