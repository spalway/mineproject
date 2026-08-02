import { describe, it, expect, beforeEach } from 'vitest'
import {
  getDb,
  openRound,
  currentRound,
  closeRound,
  claimSpot,
  releaseSpot,
  liveSpots,
  spotByWallet,
  sectorTaken,
  occupiedSectors,
  bumpDepth,
  setSpotTokens,
  recordPayout,
  owedByWallet,
  walletPayouts,
  markWalletPaid,
  totalOwed,
  totalPaid,
  issueNonce,
  consumeNonce,
  getCarried,
  setCarried,
  getLastTreasury,
  setLastTreasury,
  insertMint,
  roundMints,
} from '@/lib/db'

beforeEach(() => {
  getDb(':memory:', { reset: true })
})

describe('rounds', () => {
  it('opens and finds the current round', () => {
    const id = openRound(1000)
    expect(currentRound()?.id).toBe(id)
  })

  it('stops being current once closed', () => {
    const id = openRound(1000)
    closeRound(id, {
      endedAt: 2000,
      status: 'resolved',
      strikeSector: 5,
      pot: 100,
      carried: 0,
      feeAccrued: 200,
      treasury: 5000,
      migrationMint: null,
      mintCount: 3,
      uptimeRatio: 1,
    })
    expect(currentRound()).toBeUndefined()
  })
})

describe('spots', () => {
  it('claims and lists live spots', () => {
    claimSpot({ wallet: 'w1', sector: 3, tokens: 12_000, round: 1 })
    expect(liveSpots()).toHaveLength(1)
  })

  it('refuses a second live spot for the same wallet', () => {
    claimSpot({ wallet: 'w1', sector: 3, tokens: 12_000, round: 1 })
    expect(() => claimSpot({ wallet: 'w1', sector: 9, tokens: 12_000, round: 1 })).toThrow()
  })

  it('lets a wallet claim again after releasing', () => {
    const id = claimSpot({ wallet: 'w1', sector: 3, tokens: 12_000, round: 1 })
    releaseSpot(id, 2, 'released by holder')
    expect(() =>
      claimSpot({ wallet: 'w1', sector: 9, tokens: 12_000, round: 2 }),
    ).not.toThrow()
    expect(liveSpots()).toHaveLength(1)
  })

  it('reports a sector as taken only while the spot is live', () => {
    const id = claimSpot({ wallet: 'w1', sector: 3, tokens: 12_000, round: 1 })
    expect(sectorTaken(3)).toBe(true)
    releaseSpot(id, 2, 'released by holder')
    expect(sectorTaken(3)).toBe(false)
  })

  it('finds a spot by wallet', () => {
    claimSpot({ wallet: 'w1', sector: 3, tokens: 12_000, round: 1 })
    expect(spotByWallet('w1')?.sector).toBe(3)
    expect(spotByWallet('nobody')).toBeUndefined()
  })

  it('reports occupied sectors without duplicates', () => {
    claimSpot({ wallet: 'w1', sector: 3, tokens: 12_000, round: 1 })
    claimSpot({ wallet: 'w2', sector: 9, tokens: 12_000, round: 1 })
    expect([...occupiedSectors()].sort((a, b) => a - b)).toEqual([3, 9])
  })

  it('accrues depth and tracks token balance', () => {
    const id = claimSpot({ wallet: 'w1', sector: 3, tokens: 12_000, round: 1 })
    bumpDepth([id])
    bumpDepth([id])
    setSpotTokens(id, 25_000)
    expect(liveSpots()[0].depth).toBe(2)
    expect(liveSpots()[0].tokens).toBe(25_000)
  })
})

describe('payouts', () => {
  it('is idempotent per (round, spot, kind)', () => {
    recordPayout({ roundId: 1, wallet: 'w1', spotId: 7, kind: 'strike', lamports: 500 })
    recordPayout({ roundId: 1, wallet: 'w1', spotId: 7, kind: 'strike', lamports: 500 })
    expect(walletPayouts('w1')).toHaveLength(1)
  })

  it('lets one spot take strike and pool in the same round', () => {
    recordPayout({ roundId: 1, wallet: 'w1', spotId: 7, kind: 'strike', lamports: 500 })
    recordPayout({ roundId: 1, wallet: 'w1', spotId: 7, kind: 'pool', lamports: 300 })
    expect(totalOwed()).toBe(800)
  })

  it('aggregates what is owed per wallet', () => {
    recordPayout({ roundId: 1, wallet: 'w1', spotId: 1, kind: 'pool', lamports: 300 })
    recordPayout({ roundId: 2, wallet: 'w1', spotId: 1, kind: 'pool', lamports: 200 })
    recordPayout({ roundId: 2, wallet: 'w2', spotId: 2, kind: 'pool', lamports: 900 })

    const owed = owedByWallet()
    expect(owed[0]).toMatchObject({ wallet: 'w2', lamports: 900 })
    expect(owed[1]).toMatchObject({ wallet: 'w1', lamports: 500, rounds: 2 })
  })

  it('settles a wallet by hand and moves it out of owed', () => {
    recordPayout({ roundId: 1, wallet: 'w1', spotId: 1, kind: 'pool', lamports: 300 })
    recordPayout({ roundId: 2, wallet: 'w1', spotId: 1, kind: 'pool', lamports: 200 })

    expect(markWalletPaid('w1', 'sig-abc')).toBe(2)
    expect(totalOwed()).toBe(0)
    expect(totalPaid()).toBe(500)
    expect(walletPayouts('w1')[0].signature).toBe('sig-abc')
  })

  it('leaves other wallets untouched when settling one', () => {
    recordPayout({ roundId: 1, wallet: 'w1', spotId: 1, kind: 'pool', lamports: 300 })
    recordPayout({ roundId: 1, wallet: 'w2', spotId: 2, kind: 'pool', lamports: 400 })
    markWalletPaid('w1', 'sig-abc')
    expect(totalOwed()).toBe(400)
  })
})

describe('carry and treasury marks', () => {
  it('round-trips the carried pot', () => {
    expect(getCarried()).toBe(0)
    setCarried(12_345)
    expect(getCarried()).toBe(12_345)
  })

  it('starts with no treasury mark, then remembers one', () => {
    expect(getLastTreasury()).toBe(null)
    setLastTreasury(999)
    expect(getLastTreasury()).toBe(999)
  })
})

describe('nonces', () => {
  it('accepts a nonce once, bound to its wallet', () => {
    issueNonce('w1', 'n1')
    expect(consumeNonce('w1', 'n1')).toBe(true)
    expect(consumeNonce('w1', 'n1')).toBe(false)
  })

  it('rejects a nonce issued to a different wallet', () => {
    issueNonce('w1', 'n1')
    expect(consumeNonce('w2', 'n1')).toBe(false)
  })

  it('rejects an unknown nonce', () => {
    expect(consumeNonce('w1', 'never-issued')).toBe(false)
  })
})

describe('mints', () => {
  it('ignores a duplicate mint rather than throwing', () => {
    insertMint({ mint: 'm1', sector: 3, roundId: 1, receivedAt: 10, creator: 'c1' })
    insertMint({ mint: 'm1', sector: 3, roundId: 1, receivedAt: 20, creator: 'c1' })
    expect(roundMints(1)).toHaveLength(1)
  })

  it('returns round mints in arrival order', () => {
    insertMint({ mint: 'm2', sector: 3, roundId: 1, receivedAt: 30, creator: 'c' })
    insertMint({ mint: 'm1', sector: 4, roundId: 1, receivedAt: 10, creator: 'c' })
    expect(roundMints(1).map((m) => m.received_at)).toEqual([10, 30])
  })
})
