import { describe, it, expect } from 'vitest'
import { riftComponents, riftClaimants } from '@/lib/rift'

describe('riftComponents', () => {
  it('groups adjacent occupied sectors', () => {
    const comps = riftComponents(new Set([0, 1, 2, 20]))
    expect(comps).toHaveLength(2)
    expect(comps).toEqual(expect.arrayContaining([[0, 1, 2], [20]]))
  })

  it('returns empty for empty input', () => {
    expect(riftComponents(new Set())).toEqual([])
  })

  it('links vertically as well as horizontally', () => {
    // 0 and 8 are the same column, adjacent rows.
    expect(riftComponents(new Set([0, 8]))).toEqual([[0, 8]])
  })
})

describe('riftClaimants', () => {
  it('reaches exactly two hops through occupied sectors', () => {
    expect(riftClaimants(0, new Set([0, 1, 2, 3])).sort((a, b) => a - b)).toEqual([1, 2])
  })

  it('excludes the striking sector itself', () => {
    expect(riftClaimants(0, new Set([0, 1]))).not.toContain(0)
  })

  it('cannot tunnel through an unoccupied gap', () => {
    expect(riftClaimants(0, new Set([0, 2]))).toEqual([])
  })

  it('returns empty when the striking sector is unoccupied', () => {
    expect(riftClaimants(5, new Set([0, 1]))).toEqual([])
  })
})
