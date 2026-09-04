import { describe, it, expect } from 'vitest'
import { countXp, isLevelUp, levelAtTime, levelName, nextSlotAfter, toCandidate } from '@/actions/roulette-helpers'

describe('countXp', () => {
  it('식당별 확정 횟수를 세고, 요청한 id는 0이라도 포함한다', () => {
    const rows = [
      { chosen_restaurant_id: 'a' },
      { chosen_restaurant_id: 'a' },
      { chosen_restaurant_id: 'b' },
      { chosen_restaurant_id: null },
    ]
    const map = countXp(rows, ['a', 'b', 'c'])
    expect(map.get('a')).toBe(2)
    expect(map.get('b')).toBe(1)
    expect(map.get('c')).toBe(0)
  })
})

describe('isLevelUp', () => {
  it.each([
    [0, false],
    [1, true], // 0→1: 처음→익숙
    [2, false], // 1→2: 익숙 유지
    [3, true], // 2→3: 익숙→단골
    [7, true],
    [8, false],
    [15, true],
    [16, false],
  ])('newXp %i → %s', (xp, expected) => {
    expect(isLevelUp(xp)).toBe(expected)
  })
})

describe('levelAtTime', () => {
  const rows = [
    { chosen_restaurant_id: 'a', confirmed_at: '2026-09-01T03:00:00Z' },
    { chosen_restaurant_id: 'a', confirmed_at: '2026-09-02T03:00:00Z' },
    { chosen_restaurant_id: 'b', confirmed_at: '2026-09-02T09:00:00Z' },
    { chosen_restaurant_id: 'a', confirmed_at: '2026-09-03T03:00:00Z' },
    { chosen_restaurant_id: 'a', confirmed_at: '2026-09-04T03:00:00Z' },
  ]
  it('첫 확정은 레벨 2(익숙), 세 번째 확정은 레벨 3(단골)', () => {
    expect(levelAtTime(rows, 'a', '2026-09-01T03:00:00Z')).toBe(2)
    expect(levelAtTime(rows, 'a', '2026-09-02T03:00:00Z')).toBe(2)
    expect(levelAtTime(rows, 'a', '2026-09-03T03:00:00Z')).toBe(3)
    expect(levelAtTime(rows, 'a', '2026-09-04T03:00:00Z')).toBe(3)
  })
  it('다른 식당의 확정은 세지 않는다', () => {
    expect(levelAtTime(rows, 'b', '2026-09-02T09:00:00Z')).toBe(2)
  })
  it('입력 순서와 무관하게 시각으로 판단한다', () => {
    const shuffled = [...rows].reverse()
    expect(levelAtTime(shuffled, 'a', '2026-09-03T03:00:00Z')).toBe(3)
  })
})

describe('toCandidate', () => {
  it('경험치를 레벨 배지로 환산한다', () => {
    const c = toCandidate({ id: 'r', name: '식당', address: '주소', hours: null }, 3)
    expect(c).toEqual({ id: 'r', name: '식당', address: '주소', xp: 3, level: 3, levelName: '단골', nextIn: 4 })
  })
})

describe('nextSlotAfter', () => {
  const seoul = (iso: string) => new Date(`${iso}+09:00`)
  it('점심 슬롯 안이면 저녁 시작 17:00', () => {
    expect(nextSlotAfter('lunch', seoul('2026-09-04T12:30:00'))).toBe('17:00')
  })
  it('저녁 슬롯 안이면 다음 날 점심 11:00', () => {
    expect(nextSlotAfter('dinner', seoul('2026-09-04T19:00:00'))).toBe('11:00')
  })
})

describe('levelName', () => {
  it('레벨 번호를 이름으로 바꾼다', () => {
    expect(levelName(1)).toBe('처음')
    expect(levelName(3)).toBe('단골')
    expect(levelName(5)).toBe('집밥')
  })
})
