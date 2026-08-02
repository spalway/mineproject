import { describe, it, expect, beforeEach } from 'vitest'
import {
  getDb,
  openEpoch,
  currentEpoch,
  closeEpoch,
  createRig,
  activeRigs,
  occupiedSectors,
  rigsInSectors,
  closeRig,
  bumpDepth,
  setRigBalance,
  consumeSignature,
  issueNonce,
  consumeNonce,
  addToVein,
  veinBalance,
  resetVein,
  recordPayout,
  pendingPayouts,
  markPayoutSent,
  insertMint,
  epochMints,
} from '@/lib/db'

beforeEach(() => {
  getDb(':memory:', { reset: true })
})

describe('epochs', () => {
  it('opens and finds the current epoch', () => {
    const id = openEpoch(1000)
    expect(currentEpoch()?.id).toBe(id)
  })

  it('stops being current once closed', () => {
    const id = openEpoch(1000)
    closeEpoch(id, {
      endedAt: 2000,
      status: 'resolved',
      strikeSector: 5,
      pot: 100,
      treasury: 4,
      veinAdd: 6,
      veinPaid: 0,
      migrationMint: null,
      mintCount: 3,
      uptimeRatio: 1,
    })
    expect(currentEpoch()).toBeUndefined()
  })
})

describe('rigs', () => {
  it('creates and lists active rigs', () => {
    createRig({ wallet: 'w1', sector: 3, lamports: 50_000_000, sig: 's1', epoch: 1 })
    expect(activeRigs()).toHaveLength(1)
  })

  it('rejects a duplicate deploy signature', () => {
    createRig({ wallet: 'w1', sector: 3, lamports: 1000, sig: 's1', epoch: 1 })
    expect(() =>
      createRig({ wallet: 'w2', sector: 4, lamports: 1000, sig: 's1', epoch: 1 }),
    ).toThrow()
  })

  it('allows one wallet several rigs in the same sector', () => {
    createRig({ wallet: 'w1', sector: 3, lamports: 1000, sig: 'a', epoch: 1 })
    createRig({ wallet: 'w1', sector: 3, lamports: 2000, sig: 'b', epoch: 1 })
    expect(activeRigs()).toHaveLength(2)
  })

  it('reports occupied sectors without duplicates', () => {
    createRig({ wallet: 'w1', sector: 3, lamports: 1000, sig: 'a', epoch: 1 })
    createRig({ wallet: 'w2', sector: 3, lamports: 1000, sig: 'b', epoch: 1 })
    createRig({ wallet: 'w3', sector: 9, lamports: 1000, sig: 'c', epoch: 1 })
    expect([...occupiedSectors()].sort((a, b) => a - b)).toEqual([3, 9])
  })

  it('finds rigs by sector', () => {
    createRig({ wallet: 'w1', sector: 3, lamports: 1000, sig: 'a', epoch: 1 })
    createRig({ wallet: 'w2', sector: 9, lamports: 1000, sig: 'b', epoch: 1 })
    expect(rigsInSectors([9])).toHaveLength(1)
    expect(rigsInSectors([])).toHaveLength(0)
  })

  it('drops a closed rig out of the active set', () => {
    const id = createRig({ wallet: 'w1', sector: 3, lamports: 1000, sig: 'a', epoch: 1 })
    closeRig(id, 2)
    expect(activeRigs()).toHaveLength(0)
  })

  it('drops a zero-balance rig out of the active set', () => {
    const id = createRig({ wallet: 'w1', sector: 3, lamports: 1000, sig: 'a', epoch: 1 })
    setRigBalance(id, 0)
    expect(activeRigs()).toHaveLength(0)
  })

  it('accrues depth', () => {
    const id = createRig({ wallet: 'w1', sector: 3, lamports: 1000, sig: 'a', epoch: 1 })
    bumpDepth([id])
    bumpDepth([id])
    expect(activeRigs()[0].depth).toBe(2)
  })
})

describe('signature replay protection', () => {
  it('accepts a signature once and never again', () => {
    expect(consumeSignature('sig-1')).toBe(true)
    expect(consumeSignature('sig-1')).toBe(false)
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

describe('vein', () => {
  it('accumulates and resets', () => {
    addToVein(600)
    addToVein(400)
    expect(veinBalance()).toBe(1000)
    resetVein()
    expect(veinBalance()).toBe(0)
  })
})

describe('payouts', () => {
  it('is idempotent per (epoch, rig, kind)', () => {
    recordPayout({ epochId: 1, wallet: 'w1', rigId: 7, kind: 'strike', lamports: 500 })
    recordPayout({ epochId: 1, wallet: 'w1', rigId: 7, kind: 'strike', lamports: 500 })
    expect(pendingPayouts()).toHaveLength(1)
  })

  it('lets the same rig take a strike and a vein payout in one epoch', () => {
    recordPayout({ epochId: 1, wallet: 'w1', rigId: 7, kind: 'strike', lamports: 500 })
    recordPayout({ epochId: 1, wallet: 'w1', rigId: 7, kind: 'vein', lamports: 900 })
    expect(pendingPayouts()).toHaveLength(2)
  })

  it('skips zero-lamport payouts', () => {
    recordPayout({ epochId: 1, wallet: 'w1', rigId: 7, kind: 'strike', lamports: 0 })
    expect(pendingPayouts()).toHaveLength(0)
  })

  it('stops being pending once sent', () => {
    recordPayout({ epochId: 1, wallet: 'w1', rigId: 7, kind: 'strike', lamports: 500 })
    markPayoutSent([pendingPayouts()[0].id], 'sig-abc')
    expect(pendingPayouts()).toHaveLength(0)
  })
})

describe('mints', () => {
  it('ignores a duplicate mint rather than throwing', () => {
    insertMint({ mint: 'm1', sector: 3, epochId: 1, receivedAt: 10, creator: 'c1' })
    insertMint({ mint: 'm1', sector: 3, epochId: 1, receivedAt: 20, creator: 'c1' })
    expect(epochMints(1)).toHaveLength(1)
  })

  it('returns epoch mints in arrival order', () => {
    insertMint({ mint: 'm2', sector: 3, epochId: 1, receivedAt: 30, creator: 'c' })
    insertMint({ mint: 'm1', sector: 4, epochId: 1, receivedAt: 10, creator: 'c' })
    expect(epochMints(1).map((m) => m.received_at)).toEqual([10, 30])
  })
})
