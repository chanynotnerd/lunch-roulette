import { describe, it, expect } from 'vitest'
import { validateHours, isValidHours, isDayHoursShape, TIME_RE } from '@/rules/hours-schema'
import { DAY_KEYS } from '@/rules/types'
import { DEFAULT_HOURS } from '@/config/default-hours'

function everyDay(day: unknown): Record<string, unknown> {
  return Object.fromEntries(DAY_KEYS.map((k) => [k, day]))
}

// 스펙 10 보정 파일 예시
const specExample = {
  mon: { open: '11:00', close: '21:00', break: { start: '15:00', end: '17:00' } },
  tue: { open: '11:00', close: '21:00', break: { start: '15:00', end: '17:00' } },
  wed: { closed: true },
  thu: { open: '11:00', close: '21:00', break: { start: '15:00', end: '17:00' } },
  fri: { open: '11:00', close: '21:00', break: { start: '15:00', end: '17:00' } },
  sat: { open: '11:00', close: '20:00' },
  sun: { closed: true },
}

describe('TIME_RE', () => {
  it.each(['00:00', '09:30', '23:59', '24:00'])('accepts %s', (t) => {
    expect(TIME_RE.test(t)).toBe(true)
  })
  it.each(['24:01', '24:59', '25:00', '9:30', '12:60', '12', '1200', ''])('rejects %s', (t) => {
    expect(TIME_RE.test(t)).toBe(false)
  })
})

describe('validateHours – accepts', () => {
  it('the spec 10 example', () => {
    expect(validateHours(specExample)).toEqual([])
    expect(isValidHours(specExample)).toBe(true)
  })
  it('DEFAULT_HOURS', () => {
    expect(validateHours(DEFAULT_HOURS)).toEqual([])
  })
  it('24h day "00:00"-"24:00"', () => {
    expect(validateHours(everyDay({ open: '00:00', close: '24:00' }))).toEqual([])
  })
  it('overnight day with a break before midnight', () => {
    expect(
      validateHours(everyDay({ open: '17:00', close: '02:00', break: { start: '20:00', end: '20:30' } })),
    ).toEqual([])
  })
  it('all closed', () => {
    expect(validateHours(everyDay({ closed: true }))).toEqual([])
  })
})

describe('validateHours – rejects', () => {
  const bad = (day: unknown) => validateHours({ ...specExample, mon: day })

  it('non-object roots', () => {
    expect(validateHours(null).length).toBeGreaterThan(0)
    expect(validateHours([]).length).toBeGreaterThan(0)
    expect(validateHours('x').length).toBeGreaterThan(0)
    expect(isValidHours(undefined)).toBe(false)
  })
  it('missing weekday', () => {
    const rest: Record<string, unknown> = { ...specExample }
    delete rest.sun
    expect(validateHours(rest).join()).toContain('sun')
  })
  it('unknown weekday key', () => {
    expect(validateHours({ ...specExample, hol: { closed: true } }).join()).toContain('hol')
  })
  it('non-object day', () => {
    expect(bad(5).length).toBeGreaterThan(0)
    expect(bad(null).length).toBeGreaterThan(0)
  })
  it('closed:false (closed days are {closed:true} only)', () => {
    expect(bad({ closed: false, open: '11:00', close: '21:00' }).length).toBeGreaterThan(0)
    expect(bad({ closed: false }).length).toBeGreaterThan(0)
  })
  it('closed:true with other keys', () => {
    expect(bad({ closed: true, open: '11:00', close: '21:00' }).length).toBeGreaterThan(0)
  })
  it('unknown keys inside a day', () => {
    expect(bad({ open: '11:00', close: '21:00', note: 'x' }).join()).toContain('note')
  })
  it('unknown keys inside break', () => {
    expect(bad({ open: '11:00', close: '21:00', break: { start: '15:00', end: '17:00', x: 1 } }).length).toBeGreaterThan(0)
  })
  it('24:01~24:59 (24:00 allowed)', () => {
    expect(bad({ open: '11:00', close: '24:01' }).length).toBeGreaterThan(0)
    expect(bad({ open: '11:00', close: '24:59' }).length).toBeGreaterThan(0)
    expect(bad({ open: '11:00', close: '24:00' })).toEqual([])
  })
  it('open === close', () => {
    expect(bad({ open: '11:00', close: '11:00' }).length).toBeGreaterThan(0)
  })
  it('malformed open/close', () => {
    expect(bad({ open: '25:00', close: '21:00' }).length).toBeGreaterThan(0)
    expect(bad({ open: 660, close: '21:00' }).length).toBeGreaterThan(0)
    expect(bad({ close: '21:00' }).length).toBeGreaterThan(0)
  })
  it('break.start >= break.end', () => {
    expect(bad({ open: '11:00', close: '21:00', break: { start: '17:00', end: '15:00' } }).length).toBeGreaterThan(0)
    expect(bad({ open: '11:00', close: '21:00', break: { start: '15:00', end: '15:00' } }).length).toBeGreaterThan(0)
  })
  it('break outside open~close', () => {
    expect(bad({ open: '11:00', close: '21:00', break: { start: '10:00', end: '12:00' } }).length).toBeGreaterThan(0)
    expect(bad({ open: '11:00', close: '21:00', break: { start: '20:00', end: '22:00' } }).length).toBeGreaterThan(0)
  })
  it('overnight break after midnight is not representable', () => {
    expect(bad({ open: '17:00', close: '02:00', break: { start: '00:30', end: '01:00' } }).length).toBeGreaterThan(0)
  })
  it('malformed break', () => {
    expect(bad({ open: '11:00', close: '21:00', break: '15-17' }).length).toBeGreaterThan(0)
    expect(bad({ open: '11:00', close: '21:00', break: { start: '15:00' } }).length).toBeGreaterThan(0)
  })
  it('error paths carry the given prefix', () => {
    expect(validateHours({ ...specExample, mon: 5 }, 'kakao:1.hours')[0]).toMatch(/^kakao:1\.hours\.mon/)
  })
})

describe('isDayHoursShape (lenient runtime shape)', () => {
  it('accepts closed:true and open/close days', () => {
    expect(isDayHoursShape({ closed: true })).toBe(true)
    expect(isDayHoursShape({ open: '11:00', close: '21:00' })).toBe(true)
    expect(isDayHoursShape({ open: '11:00', close: '21:00', break: { start: '15:00', end: '17:00' } })).toBe(true)
  })
  it('tolerates closed:false alongside open/close and unknown keys', () => {
    expect(isDayHoursShape({ closed: false, open: '11:00', close: '21:00', note: 'x' })).toBe(true)
  })
  it('rejects malformed entries', () => {
    expect(isDayHoursShape(null)).toBe(false)
    expect(isDayHoursShape(5)).toBe(false)
    expect(isDayHoursShape({ closed: false })).toBe(false)
    expect(isDayHoursShape({ open: '25:00', close: '21:00' })).toBe(false)
    expect(isDayHoursShape({ open: '11:00', close: '21:00', break: { start: '15:00' } })).toBe(false)
  })
})
