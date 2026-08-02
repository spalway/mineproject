import { describe, it, expect } from 'vitest'
import { weightOf, allocate, splitPot, splitVein, drawOf, type Rig } from '@/lib/payout'

const rig = (id: number, balance: number, depth = 0): Rig => ({
  id,
  wallet: `w${id}`,
  sector: 0,
  balance,
  depth,
})

const sumOf = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0)

describe('weightOf', () => {
  it('is balance at zero depth', () => {
    expect(weightOf(rig(1, 1000))).toBe(1000)
  })
  it('caps the multiplier at 3x', () => {
    expect(weightOf(rig(1, 1000, 999))).toBe(3000)
  })
  it('scales linearly to the cap', () => {
    expect(weightOf(rig(1, 1000, 30))).toBe(2000)
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
  it('conserves the pot exactly across every bucket', () => {
    const a = splitPot(1_000_003, [rig(1, 500), rig(2, 250)], [rig(3, 100)])
    expect(a.treasury + a.vein + a.veinRollover + sumOf(a.strikers) + sumOf(a.rift)).toBe(1_000_003)
  })

  it('rolls the rift share to strikers when there are no claimants', () => {
    const a = splitPot(10_000, [rig(1, 100)], [])
    expect(sumOf(a.strikers)).toBe(9_000)
    expect(a.rift.size).toBe(0)
  })

  it('pays claimants the rift share when they exist', () => {
    const a = splitPot(10_000, [rig(1, 100)], [rig(2, 100)])
    expect(sumOf(a.strikers)).toBe(7_500)
    expect(sumOf(a.rift)).toBe(1_500)
  })

  it('routes 90% to vein rollover on an unoccupied strike', () => {
    const a = splitPot(10_000, [], [])
    expect(a.veinRollover).toBe(9_000)
    expect(a.treasury).toBe(400)
    expect(a.vein).toBe(600)
    expect(a.strikers.size).toBe(0)
  })

  it('weights payouts by depth, not just balance', () => {
    const a = splitPot(10_000, [rig(1, 100, 0), rig(2, 100, 60)], [])
    // weights 100 and 300 -> 1:3
    expect(a.strikers.get(1)).toBe(2_250)
    expect(a.strikers.get(2)).toBe(6_750)
  })
})

describe('splitVein', () => {
  it('pays nothing when the striking sector is unoccupied', () => {
    expect(splitVein(500_000, []).size).toBe(0)
  })
  it('distributes the whole balance to strikers', () => {
    expect(sumOf(splitVein(500_000, [rig(1, 10), rig(2, 30)]))).toBe(500_000)
  })
})

describe('drawOf', () => {
  it('burns 1% per epoch', () => {
    expect(drawOf(1_000_000)).toBe(10_000)
  })
  it('floors rather than rounding up', () => {
    expect(drawOf(99)).toBe(0)
  })
})
