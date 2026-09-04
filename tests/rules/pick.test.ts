import { describe, it, expect } from 'vitest'
import { pickCandidates } from '@/rules/pick'

describe('pickCandidates', () => {
  it('pool of exactly 3 returns all 3', () => {
    const pool = ['a', 'b', 'c']
    const picked = pickCandidates(pool)
    expect(picked).toHaveLength(3)
    expect(new Set(picked)).toEqual(new Set(pool))
  })

  it('pool of 10 returns 3 distinct members of the pool', () => {
    const pool = Array.from({ length: 10 }, (_, i) => `r${i}`)
    for (let run = 0; run < 50; run++) {
      const picked = pickCandidates(pool)
      expect(picked).toHaveLength(3)
      expect(new Set(picked).size).toBe(3)
      for (const p of picked) expect(pool).toContain(p)
    }
  })

  it('pool of 2 throws NOT_ENOUGH', () => {
    expect(() => pickCandidates(['a', 'b'])).toThrow('NOT_ENOUGH')
  })

  it('empty pool throws NOT_ENOUGH', () => {
    expect(() => pickCandidates([])).toThrow('NOT_ENOUGH')
  })

  it('does not mutate the input pool', () => {
    const pool = [1, 2, 3, 4, 5]
    const copy = [...pool]
    pickCandidates(pool, 3, () => 0.7)
    expect(pool).toEqual(copy)
  })

  it('is deterministic with a fixed rng (rng = () => 0)', () => {
    const pool = ['a', 'b', 'c', 'd', 'e']
    const first = pickCandidates(pool, 3, () => 0)
    const second = pickCandidates(pool, 3, () => 0)
    expect(first).toEqual(second)
    expect(first).toHaveLength(3)
    expect(new Set(first).size).toBe(3)
  })

  it('respects custom n', () => {
    const pool = [1, 2, 3, 4]
    expect(pickCandidates(pool, 4, () => 0.5)).toHaveLength(4)
    expect(() => pickCandidates(pool, 5)).toThrow('NOT_ENOUGH')
  })

  it('rng near 1 never indexes out of bounds', () => {
    const pool = ['a', 'b', 'c', 'd']
    const picked = pickCandidates(pool, 3, () => 0.999999)
    expect(new Set(picked).size).toBe(3)
    for (const p of picked) expect(pool).toContain(p)
  })
})
