import { describe, it, expect } from 'vitest'
import { weightOf, allocate, splitPot, totalPerSpot, feeShare, type Spot } from '@/lib/payout'
import { CONFIG } from '@/lib/config'

const spot = (id: number, sector: number, depth = 0): Spot => ({
  id,
  wallet: `w${id}`,
  sector,
  depth,
  tokens: 10_000,
})

const sumOf = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0)

describe('weightOf', () => {
  it('is 1 for a spot claimed this round', () => {
    expect(weightOf(spot(1, 0))).toBe(1)
  })
  it('caps at 3x', () => {
    expect(weightOf(spot(1, 0, 999))).toBe(3)
  })
  it('scales linearly to the cap', () => {
    expect(weightOf(spot(1, 0, CONFIG.DEPTH_K))).toBe(2)
  })
})

describe('allocate', () => {
  it('conserves lamports exactly with awkward remainders', () => {
    expect(allocate(100, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('never returns a fractional lamport', () => {
    for (const v of allocate(7, [3, 5, 11])) expect(Number.isInteger(v)).toBe(true)
  })

  it('returns zeros when all weights are zero', () => {
    expect(allocate(100, [0, 0])).toEqual([0, 0])
  })

  it('conserves across many randomised splits', () => {
    for (let t = 0; t < 500; t++) {
      const n = 1 + Math.floor(Math.random() * 12)
      const total = Math.floor(Math.random() * 1_000_000_000)
      const weights = Array.from({ length: n }, () => Math.floor(Math.random() * 1e6))
      const out = allocate(total, weights)
      const expected = weights.reduce((a, b) => a + b, 0) > 0 ? total : 0
      expect(out.reduce((a, b) => a + b, 0)).toBe(expected)
    }
  })
})

describe('splitPot', () => {
  it('conserves the pot exactly across every leg plus carry', () => {
    const strikers = [spot(1, 0)]
    const claimants = [spot(2, 1)]
    const everyone = [spot(1, 0), spot(2, 1), spot(3, 40, 12)]

    const a = splitPot(1_000_003, strikers, claimants, everyone)
    expect(sumOf(a.strike) + sumOf(a.rift) + sumOf(a.pool) + a.carried).toBe(1_000_003)
  })

  it('splits 50/20/30 when every leg has takers', () => {
    const a = splitPot(10_000, [spot(1, 0)], [spot(2, 1)], [spot(1, 0), spot(2, 1)])
    expect(sumOf(a.strike)).toBe(5_000)
    expect(sumOf(a.rift)).toBe(2_000)
    expect(sumOf(a.pool)).toBe(3_000)
    expect(a.carried).toBe(0)
  })

  it('carries the rift leg when nobody is adjacent', () => {
    const a = splitPot(10_000, [spot(1, 0)], [], [spot(1, 0)])
    expect(sumOf(a.rift)).toBe(0)
    expect(a.carried).toBe(2_000)
  })

  it('carries the whole pot when the field is empty', () => {
    const a = splitPot(10_000, [], [], [])
    expect(a.carried).toBe(10_000)
  })

  it('carries the strike leg when the striking sector is unclaimed', () => {
    // Someone holds a spot, but not in the sector that struck.
    const a = splitPot(10_000, [], [], [spot(3, 40)])
    expect(sumOf(a.strike)).toBe(0)
    expect(sumOf(a.pool)).toBe(3_000)
    expect(a.carried).toBe(7_000)
  })

  it('weights the pool leg by depth', () => {
    const shallow = spot(1, 0, 0)
    const deep = spot(2, 40, CONFIG.DEPTH_CAP)
    const a = splitPot(10_000, [], [], [shallow, deep])
    // weights 1 and 3, so 1:3 of the 3000 pool leg
    expect(a.pool.get(1)).toBe(750)
    expect(a.pool.get(2)).toBe(2_250)
  })

  it('pays a striker from both the strike leg and the pool leg', () => {
    const s = spot(1, 0)
    const alloc = splitPot(10_000, [s], [], [s])
    expect(totalPerSpot(alloc).get(1)).toBe(8_000)
  })
})

describe('feeShare', () => {
  it('takes 70% of what accrued', () => {
    expect(feeShare(1_000_000)).toBe(700_000)
  })
  it('is zero when nothing accrued', () => {
    expect(feeShare(0)).toBe(0)
  })
  it('never goes negative on a treasury withdrawal', () => {
    expect(feeShare(-5_000)).toBe(0)
  })
})
