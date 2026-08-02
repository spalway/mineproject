import { describe, it, expect } from 'vitest'
import { computeGrades, resolveEpoch, type MintEvent } from '@/lib/engine'

const m = (sector: number, receivedAt: number, creator = `c${receivedAt}`): MintEvent => ({
  mint: `m${receivedAt}-${sector}`,
  sector,
  creator,
  receivedAt,
})

describe('computeGrades', () => {
  it('counts one mint per sector per creator', () => {
    const { grades } = computeGrades([m(3, 1, 'alice'), m(3, 2, 'alice'), m(3, 3, 'bob')])
    expect(grades[3]).toBe(2)
  })

  it('lets one creator hit different sectors', () => {
    const { grades } = computeGrades([m(3, 1, 'alice'), m(4, 2, 'alice')])
    expect(grades[3]).toBe(1)
    expect(grades[4]).toBe(1)
  })

  it('returns counted mints in arrival order', () => {
    const { counted } = computeGrades([m(1, 30), m(2, 10), m(3, 20)])
    expect(counted.map((c) => c.receivedAt)).toEqual([10, 20, 30])
  })
})

describe('resolveEpoch', () => {
  it('strikes the highest grade', () => {
    const r = resolveEpoch({ mints: [m(5, 1), m(5, 2), m(9, 3)], migrations: [], uptimeRatio: 1 })
    expect(r.strikeSector).toBe(5)
  })

  it('breaks ties by which sector reached the winning count first', () => {
    // Both reach 2. Sector 9 gets its 2nd at t=3, sector 5 at t=4.
    const r = resolveEpoch({
      mints: [m(5, 1), m(9, 2), m(9, 3), m(5, 4)],
      migrations: [],
      uptimeRatio: 1,
    })
    expect(r.strikeSector).toBe(9)
  })

  it('voids below the uptime threshold and strikes nothing', () => {
    const r = resolveEpoch({ mints: [m(5, 1)], migrations: [], uptimeRatio: 0.5 })
    expect(r.status).toBe('void')
    expect(r.strikeSector).toBe(null)
  })

  it('resolves at exactly the uptime threshold', () => {
    const r = resolveEpoch({ mints: [m(5, 1)], migrations: [], uptimeRatio: 0.8 })
    expect(r.status).toBe('resolved')
  })

  it('reports a migration only when it landed in the striking sector', () => {
    const hit = resolveEpoch({
      mints: [m(5, 1)],
      migrations: [{ mint: 'g', sector: 5 }],
      uptimeRatio: 1,
    })
    expect(hit.migrationMint).toBe('g')

    const miss = resolveEpoch({
      mints: [m(5, 1)],
      migrations: [{ mint: 'g', sector: 6 }],
      uptimeRatio: 1,
    })
    expect(miss.migrationMint).toBe(null)
  })

  it('strikes nothing when no mints arrived', () => {
    const r = resolveEpoch({ mints: [], migrations: [], uptimeRatio: 1 })
    expect(r.strikeSector).toBe(null)
    expect(r.status).toBe('resolved')
  })

  it('is deterministic for the same input', () => {
    const input = {
      mints: [m(5, 1), m(9, 2), m(9, 3), m(5, 4), m(12, 5)],
      migrations: [],
      uptimeRatio: 1,
    }
    expect(resolveEpoch(input).strikeSector).toBe(resolveEpoch(input).strikeSector)
  })
})
