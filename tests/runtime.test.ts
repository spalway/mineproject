import { describe, it, expect, beforeEach } from 'vitest'
import { tick } from '@/lib/runtime'
import { CONFIG } from '@/lib/config'
import {
  getDb,
  currentEpoch,
  createRig,
  activeRigs,
  insertMint,
  insertMigration,
  recentEpochs,
  pendingPayouts,
  veinBalance,
  addToVein,
} from '@/lib/db'

const T0 = 1_700_000_000_000
const END = T0 + CONFIG.EPOCH_MS

beforeEach(() => {
  getDb(':memory:', { reset: true })
})

/** Open epoch 1 and return its id. */
function boot(): number {
  tick(T0, 1)
  return currentEpoch()!.id
}

function seedMint(epochId: number, sector: number, at: number, creator: string) {
  insertMint({ mint: `m-${at}-${sector}`, sector, epochId, receivedAt: at, creator })
}

describe('tick', () => {
  it('opens an epoch when none exists', () => {
    boot()
    expect(currentEpoch()).toBeDefined()
  })

  it('does nothing until the epoch is due', () => {
    const id = boot()
    tick(T0 + 1_000, 1)
    expect(currentEpoch()!.id).toBe(id)
  })

  it('charges the draw and pays the striking sector', () => {
    const epochId = boot()
    createRig({ wallet: 'w1', sector: 5, lamports: 1_000_000, sig: 's1', epoch: epochId })
    seedMint(epochId, 5, T0 + 10, 'a')
    seedMint(epochId, 5, T0 + 20, 'b')
    seedMint(epochId, 9, T0 + 30, 'c')

    tick(END, 1)

    // 1% of 1_000_000
    expect(activeRigs()[0].balance).toBe(990_000)

    const closed = recentEpochs()[0]
    expect(closed.strike_sector).toBe(5)
    expect(closed.pot_lamports).toBe(10_000)
    expect(closed.treasury_lamports).toBe(400)

    const payouts = pendingPayouts()
    expect(payouts).toHaveLength(1)
    expect(payouts[0].kind).toBe('strike')
    expect(payouts[0].lamports).toBe(9_000)
    expect(veinBalance()).toBe(600)
  })

  it('rolls the whole distributable pot to the vein on an unoccupied strike', () => {
    const epochId = boot()
    // Rig sits in sector 1; the mints all land in sector 5.
    createRig({ wallet: 'w1', sector: 1, lamports: 1_000_000, sig: 's1', epoch: epochId })
    seedMint(epochId, 5, T0 + 10, 'a')
    seedMint(epochId, 5, T0 + 20, 'b')

    tick(END, 1)

    expect(recentEpochs()[0].strike_sector).toBe(5)
    expect(pendingPayouts()).toHaveLength(0)
    // 400 treasury + 600 vein + 9000 rollover
    expect(veinBalance()).toBe(9_600)
  })

  it('pays rift claimants two hops out', () => {
    const epochId = boot()
    createRig({ wallet: 'striker', sector: 0, lamports: 1_000_000, sig: 'a', epoch: epochId })
    createRig({ wallet: 'neighbour', sector: 1, lamports: 1_000_000, sig: 'b', epoch: epochId })
    seedMint(epochId, 0, T0 + 10, 'x')
    seedMint(epochId, 0, T0 + 20, 'y')

    tick(END, 1)

    const payouts = pendingPayouts()
    const strike = payouts.find((p) => p.kind === 'strike')
    const rift = payouts.find((p) => p.kind === 'rift')

    expect(strike?.wallet).toBe('striker')
    expect(rift?.wallet).toBe('neighbour')
    // pot is 20_000 across two rigs: 75% / 15%
    expect(strike?.lamports).toBe(15_000)
    expect(rift?.lamports).toBe(3_000)
  })

  it('voids the epoch when the feed was down, charging nothing', () => {
    const epochId = boot()
    createRig({ wallet: 'w1', sector: 5, lamports: 1_000_000, sig: 's1', epoch: epochId })
    seedMint(epochId, 5, T0 + 10, 'a')

    tick(END, 0.5)

    const closed = recentEpochs()[0]
    expect(closed.status).toBe('void')
    expect(closed.pot_lamports).toBe(0)
    expect(activeRigs()[0].balance).toBe(1_000_000)
    // Depth still accrues through an outage — the miner did nothing wrong.
    expect(activeRigs()[0].depth).toBe(1)
  })

  it('accrues depth and keeps it through a strike', () => {
    const epochId = boot()
    createRig({ wallet: 'w1', sector: 5, lamports: 1_000_000, sig: 's1', epoch: epochId })
    seedMint(epochId, 5, T0 + 10, 'a')

    tick(END, 1)
    expect(activeRigs()[0].depth).toBe(1)

    const next = currentEpoch()!.id
    seedMint(next, 5, END + 10, 'b')
    tick(END + CONFIG.EPOCH_MS, 1)

    expect(recentEpochs()[0].strike_sector).toBe(5)
    expect(activeRigs()[0].depth).toBe(2)
  })

  it('cracks the vein only when a graduation lands in the striking sector', () => {
    const epochId = boot()
    createRig({ wallet: 'w1', sector: 5, lamports: 1_000_000, sig: 's1', epoch: epochId })
    seedMint(epochId, 5, T0 + 10, 'a')
    insertMigration({ mint: 'grad-1', sector: 5, epochId, receivedAt: T0 + 15 })
    addToVein(500_000)

    tick(END, 1)

    const vein = pendingPayouts().find((p) => p.kind === 'vein')
    expect(vein?.lamports).toBe(500_600)
    expect(veinBalance()).toBe(0)
  })

  it('leaves the vein alone when the graduation misses the striking sector', () => {
    const epochId = boot()
    createRig({ wallet: 'w1', sector: 5, lamports: 1_000_000, sig: 's1', epoch: epochId })
    seedMint(epochId, 5, T0 + 10, 'a')
    insertMigration({ mint: 'grad-1', sector: 12, epochId, receivedAt: T0 + 15 })
    addToVein(500_000)

    tick(END, 1)

    expect(pendingPayouts().find((p) => p.kind === 'vein')).toBeUndefined()
    expect(veinBalance()).toBe(500_600)
  })

  it('conserves the pot exactly across payouts, treasury and vein', () => {
    const epochId = boot()
    createRig({ wallet: 'a', sector: 0, lamports: 3_333_333, sig: 'a', epoch: epochId })
    createRig({ wallet: 'b', sector: 0, lamports: 7_777_777, sig: 'b', epoch: epochId })
    createRig({ wallet: 'c', sector: 1, lamports: 1_111_111, sig: 'c', epoch: epochId })
    seedMint(epochId, 0, T0 + 10, 'x')
    seedMint(epochId, 0, T0 + 20, 'y')

    tick(END, 1)

    const closed = recentEpochs()[0]
    const paid = pendingPayouts().reduce((sum, p) => sum + p.lamports, 0)
    expect(paid + closed.treasury_lamports + closed.vein_add_lamports).toBe(closed.pot_lamports)
  })
})
