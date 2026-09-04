import { describe, it, expect } from 'vitest'
import { seoulClock, toMinutes, prevDay } from '@/rules/time'

describe('seoulClock', () => {
  it('2026-09-04 is Friday in Seoul', () => {
    const c = seoulClock(new Date('2026-09-04T10:59:00+09:00'))
    expect(c).toEqual({ dateStr: '2026-09-04', weekday: 'fri', minutes: 10 * 60 + 59 })
  })

  it('converts UTC instants to Seoul date and minutes', () => {
    // 2026-09-04T16:30Z == 2026-09-05T01:30+09:00 (Saturday)
    const c = seoulClock(new Date('2026-09-04T16:30:00Z'))
    expect(c).toEqual({ dateStr: '2026-09-05', weekday: 'sat', minutes: 90 })
  })

  it('midnight is 0 minutes, not 1440', () => {
    const c = seoulClock(new Date('2026-09-06T00:00:00+09:00'))
    expect(c).toEqual({ dateStr: '2026-09-06', weekday: 'sun', minutes: 0 })
  })

  it('maps every weekday (2026-08-31 is Monday)', () => {
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const monday = new Date('2026-08-31T12:00:00+09:00').getTime()
    days.forEach((d, i) => {
      expect(seoulClock(new Date(monday + i * 86_400_000)).weekday).toBe(d)
    })
  })
})

describe('toMinutes', () => {
  it('parses HH:MM', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('11:00')).toBe(660)
    expect(toMinutes('23:59')).toBe(1439)
  })
  it('"24:00" is 1440', () => {
    expect(toMinutes('24:00')).toBe(1440)
  })
})

describe('prevDay', () => {
  it('wraps mon → sun', () => {
    expect(prevDay('mon')).toBe('sun')
  })
  it('sat → fri', () => {
    expect(prevDay('sat')).toBe('fri')
  })
})
