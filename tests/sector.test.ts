import { describe, it, expect } from 'vitest'
import { Keypair } from '@solana/web3.js'
import { sectorOf, coordsOf, sectorAt, neighbors } from '@/lib/sector'

describe('sectorOf', () => {
  it('derives sector from the first pubkey byte', () => {
    const kp = Keypair.generate()
    expect(sectorOf(kp.publicKey.toBase58())).toBe(kp.publicKey.toBytes()[0] % 64)
  })

  it('is deterministic', () => {
    const k = Keypair.generate().publicKey.toBase58()
    expect(sectorOf(k)).toBe(sectorOf(k))
  })

  it('distributes roughly uniformly over 2000 keys', () => {
    const counts = new Array(64).fill(0)
    for (let i = 0; i < 2000; i++) {
      counts[sectorOf(Keypair.generate().publicKey.toBase58())]++
    }
    // ~31 expected per sector; a fair partition should never starve one.
    expect(Math.min(...counts)).toBeGreaterThan(5)
  })

  it('throws on invalid base58', () => {
    expect(() => sectorOf('not-a-key')).toThrow()
  })
})

describe('grid geometry', () => {
  it('round-trips coords', () => {
    for (let s = 0; s < 64; s++) {
      const { row, col } = coordsOf(s)
      expect(sectorAt(row, col)).toBe(s)
    }
  })

  it('gives corners 2 neighbours and interior 4', () => {
    expect(neighbors(0).sort((a, b) => a - b)).toEqual([1, 8])
    expect(neighbors(63).sort((a, b) => a - b)).toEqual([55, 62])
    expect(neighbors(9)).toHaveLength(4)
  })

  it('never wraps across a row edge', () => {
    expect(neighbors(7)).not.toContain(8)
    expect(neighbors(8)).not.toContain(7)
  })
})
