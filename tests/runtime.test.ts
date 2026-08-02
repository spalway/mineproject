import { describe, it, expect, beforeEach } from 'vitest'
import { tick } from '@/lib/runtime'
import { CONFIG } from '@/lib/config'
import {
  getDb,
  currentRound,
  claimSpot,
  liveSpots,
  insertMint,
  recentRounds,
  walletPayouts,
  totalOwed,
  getCarried,
  getLastTreasury,
} from '@/lib/db'

const T0 = 1_700_000_000_000
const R1 = T0 + CONFIG.ROUND_MS
const R2 = R1 + CONFIG.ROUND_MS

beforeEach(() => {
  getDb(':memory:', { reset: true })
})

/** Open round 1 and return its id. */
async function boot(): Promise<number> {
  await tick(T0, 1, null)
  return currentRound()!.id
}

function seedMint(roundId: number, sector: number, at: number, creator: string) {
  insertMint({ mint: `m-${at}-${sector}`, sector, roundId, receivedAt: at, creator })
}

describe('tick', () => {
  it('opens a round when none exists', async () => {
    await boot()
    expect(currentRound()).toBeDefined()
  })

  it('does nothing until the round is due', async () => {
    const id = await boot()
    await tick(T0 + 1_000, 1, null)
    expect(currentRound()!.id).toBe(id)
  })

  it('takes no fees on the first close, since there is no prior mark', async () => {
    const id = await boot()
    claimSpot({ wallet: 'w1', sector: 5, tokens: 12_000, round: id })
    seedMint(id, 5, T0 + 10, 'a')

    await tick(R1, 1, 1_000_000)

    expect(recentRounds()[0].fee_accrued_lamports).toBe(0)
    expect(getLastTreasury()).toBe(1_000_000)
    expect(totalOwed()).toBe(0)
  })

  it('pays 70% of newly accrued fees across the three legs', async () => {
    const r1 = await boot()
    claimSpot({ wallet: 'striker', sector: 0, tokens: 12_000, round: r1 })
    claimSpot({ wallet: 'neighbour', sector: 1, tokens: 12_000, round: r1 })
    seedMint(r1, 0, T0 + 10, 'a')

    // First close only records the treasury mark.
    await tick(R1, 1, 1_000_000)

    const r2 = currentRound()!.id
    seedMint(r2, 0, R1 + 10, 'b')

    // +1 SOL of creator fees accrued during round 2.
    await tick(R2, 1, 2_000_000_000)

    const round = recentRounds()[0]
    expect(round.strike_sector).toBe(0)
    expect(round.fee_accrued_lamports).toBe(1_999_000_000)
    expect(round.pot_lamports).toBe(1_399_300_000) // 70%

    const striker = walletPayouts('striker')
    const neighbour = walletPayouts('neighbour')

    expect(striker.map((p) => p.kind).sort()).toEqual(['pool', 'strike'])
    expect(neighbour.map((p) => p.kind).sort()).toEqual(['pool', 'rift'])
    for (const p of [...striker, ...neighbour]) expect(p.status).toBe('owed')
  })

  it('conserves the pot exactly across payouts and carry', async () => {
    const r1 = await boot()
    claimSpot({ wallet: 'a', sector: 0, tokens: 12_000, round: r1 })
    claimSpot({ wallet: 'b', sector: 1, tokens: 12_000, round: r1 })
    claimSpot({ wallet: 'c', sector: 40, tokens: 12_000, round: r1 })
    seedMint(r1, 0, T0 + 10, 'x')

    await tick(R1, 1, 1_000)

    const r2 = currentRound()!.id
    seedMint(r2, 0, R1 + 10, 'y')
    await tick(R2, 1, 1_000_000_007)

    const round = recentRounds()[0]
    const paidOut = ['a', 'b', 'c']
      .flatMap((w) => walletPayouts(w))
      .reduce((sum, p) => sum + p.lamports, 0)

    expect(paidOut + round.carried_lamports).toBe(round.pot_lamports)
  })

  it('carries the pot forward whole when a round voids', async () => {
    const r1 = await boot()
    claimSpot({ wallet: 'w1', sector: 5, tokens: 12_000, round: r1 })
    seedMint(r1, 5, T0 + 10, 'a')
    await tick(R1, 1, 1_000)

    const r2 = currentRound()!.id
    seedMint(r2, 5, R1 + 10, 'b')

    // Feed was down for half the round.
    await tick(R2, 0.5, 1_000_000_001)

    const round = recentRounds()[0]
    expect(round.status).toBe('void')
    expect(round.pot_lamports).toBe(0)
    expect(totalOwed()).toBe(0)
    // Accrued is 1_000_000_001 - 1_000 = 999_999_001, and 70% of that floors
    // to 699_999_300. Held, not lost.
    expect(round.fee_accrued_lamports).toBe(999_999_001)
    expect(getCarried()).toBe(699_999_300)
    // Depth still accrues through an outage.
    expect(liveSpots()[0].depth).toBe(2)
  })

  it('adds the carried pot to the next round', async () => {
    const r1 = await boot()
    claimSpot({ wallet: 'w1', sector: 5, tokens: 12_000, round: r1 })
    await tick(R1, 1, 1_000)

    // Round 2 accrues fees but nobody holds the striking sector, so the
    // strike and rift legs carry.
    const r2 = currentRound()!.id
    seedMint(r2, 60, R1 + 10, 'x')
    await tick(R2, 1, 1_000_000_001)

    expect(getCarried()).toBeGreaterThan(0)
    const carriedAfterR2 = getCarried()

    const r3 = currentRound()!.id
    seedMint(r3, 5, R2 + 10, 'y')
    // No new fees this round: the pot is purely what was carried.
    await tick(R2 + CONFIG.ROUND_MS, 1, 1_000_000_001)

    expect(recentRounds()[0].pot_lamports).toBe(carriedAfterR2)
  })

  it('never records a payout as already paid', async () => {
    const r1 = await boot()
    claimSpot({ wallet: 'w1', sector: 5, tokens: 12_000, round: r1 })
    await tick(R1, 1, 1_000)

    const r2 = currentRound()!.id
    seedMint(r2, 5, R1 + 10, 'a')
    await tick(R2, 1, 1_000_000_001)

    const payouts = walletPayouts('w1')
    expect(payouts.length).toBeGreaterThan(0)
    for (const p of payouts) {
      expect(p.status).toBe('owed')
      expect(p.signature).toBe(null)
    }
  })
})
