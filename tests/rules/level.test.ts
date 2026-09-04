import { describe, it, expect } from 'vitest'
import { getLevel } from '@/rules/level'

describe('getLevel', () => {
  it.each([
    [0, 1, '처음', 1],
    [1, 2, '익숙', 2],
    [2, 2, '익숙', 1],
    [3, 3, '단골', 4],
    [6, 3, '단골', 1],
    [7, 4, '찐단골', 8],
    [14, 4, '찐단골', 1],
    [15, 5, '집밥', null],
    [100, 5, '집밥', null],
  ])('xp %i → level %i %s, nextIn %s', (xp, level, name, nextIn) => {
    expect(getLevel(xp)).toEqual({ level, name, nextIn })
  })
})
