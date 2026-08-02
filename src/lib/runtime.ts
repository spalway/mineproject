import { CONFIG } from './config'
import { bus } from './bus'
import { Ingest, type ParsedEvent } from './ingest'
import * as db from './db'
import { resolveEpoch, computeGrades, type MintEvent } from './engine'
import { riftClaimants, riftComponents } from './rift'
import { splitPot, splitVein, drawOf, type Rig } from './payout'
import { sendBatch } from './chain'

/**
 * Owns the websocket, the epoch clock, and the payout loop. Boots once per
 * server process from instrumentation.ts.
 */

const PAYOUT_INTERVAL_MS = 15_000
const TICK_INTERVAL_MS = 1_000

type Runtime = {
  ingest: Ingest
  tickTimer: NodeJS.Timeout
  payoutTimer: NodeJS.Timeout
}

const globalRef = globalThis as unknown as { __pumpjackRuntime?: Runtime }

const toMintEvent = (r: db.MintRow): MintEvent => ({
  mint: r.mint,
  sector: r.sector,
  creator: r.creator ?? '',
  receivedAt: r.received_at,
})

// ------------------------------------------------------------------ feed

function handleEvent(e: ParsedEvent): void {
  const epoch = db.currentEpoch()
  if (!epoch) return

  const at = Date.now()

  if (e.kind === 'mint') {
    db.insertMint({
      mint: e.mint,
      sector: e.sector,
      epochId: epoch.id,
      receivedAt: at,
      name: e.name,
      symbol: e.symbol,
      uri: e.uri,
      creator: e.creator,
    })
    bus.publish({
      type: 'mint',
      mint: e.mint,
      sector: e.sector,
      symbol: e.symbol,
      name: e.name,
      at,
    })
  } else {
    db.insertMigration({ mint: e.mint, sector: e.sector, epochId: epoch.id, receivedAt: at })
    bus.publish({ type: 'migration', mint: e.mint, sector: e.sector, at })
  }

  const { grades } = computeGrades(db.epochMints(epoch.id).map(toMintEvent))
  bus.publish({ type: 'grade', grades })
}

// ----------------------------------------------------------------- clock

/**
 * Resolve the open epoch if it is due, then open the next one.
 * Exported separately from the timer so it can be driven directly in tests.
 */
export function tick(now: number, uptimeRatio: number): void {
  const epoch = db.currentEpoch()

  if (!epoch) {
    const id = db.openEpoch(now)
    bus.publish({ type: 'tick', epochId: id, startedAt: now, endsAt: now + CONFIG.EPOCH_MS })
    return
  }

  if (now < epoch.started_at + CONFIG.EPOCH_MS) return

  const mintRows = db.epochMints(epoch.id)
  const result = resolveEpoch({
    mints: mintRows.map(toMintEvent),
    migrations: db.epochMigrations(epoch.id),
    uptimeRatio,
  })

  // Record which mints the per-creator cap excluded.
  const countedSet = new Set(result.countedMints.map((m) => m.mint))
  db.markUncounted(mintRows.filter((m) => !countedSet.has(m.mint)).map((m) => m.mint))

  const activeBefore = db.activeRigs()

  if (result.status === 'void') {
    // No draw charged, no strike, but depth still accrues. We never invent
    // data to paper over a feed gap.
    db.bumpDepth(activeBefore.map((r) => r.id))
    db.closeEpoch(epoch.id, {
      endedAt: now,
      status: 'void',
      strikeSector: null,
      pot: 0,
      treasury: 0,
      veinAdd: 0,
      veinPaid: 0,
      migrationMint: null,
      mintCount: mintRows.length,
      uptimeRatio,
    })
    bus.publish({ type: 'void', epochId: epoch.id, uptimeRatio })
    openNext(now)
    return
  }

  // Charge the draw. Every active rig burns fuel whether or not it wins.
  let pot = 0
  for (const rig of activeBefore) {
    const d = drawOf(rig.balance)
    if (d <= 0) continue
    db.setRigBalance(rig.id, rig.balance - d)
    db.recordDraw(rig.id, epoch.id, d)
    pot += d
  }

  const rigsAfter = db.activeRigs()
  const occupied = db.occupiedSectors()

  const strike = result.strikeSector
  const strikers: Rig[] =
    strike === null ? [] : rigsAfter.filter((r) => r.sector === strike)

  const claimantSectors = strike === null ? [] : riftClaimants(strike, occupied)
  const claimants: Rig[] = rigsAfter.filter((r) => claimantSectors.includes(r.sector))

  const alloc = splitPot(pot, strikers, claimants)

  // Treasury cut simply stays in the treasury wallet; no transfer needed.
  const veinAdd = alloc.vein + alloc.veinRollover
  if (veinAdd > 0) db.addToVein(veinAdd)

  for (const rig of strikers) {
    const amount = alloc.strikers.get(rig.id) ?? 0
    if (amount > 0) {
      db.recordPayout({
        epochId: epoch.id,
        wallet: rig.wallet,
        rigId: rig.id,
        kind: 'strike',
        lamports: amount,
      })
    }
  }

  for (const rig of claimants) {
    const amount = alloc.rift.get(rig.id) ?? 0
    if (amount > 0) {
      db.recordPayout({
        epochId: epoch.id,
        wallet: rig.wallet,
        rigId: rig.id,
        kind: 'rift',
        lamports: amount,
      })
    }
  }

  // The vein only cracks when a real graduation lands in the striking sector,
  // and only when that sector actually holds rigs.
  let veinPaid = 0
  if (result.migrationMint && strikers.length > 0) {
    const balance = db.veinBalance()
    if (balance > 0) {
      const veinAlloc = splitVein(balance, strikers)
      for (const rig of strikers) {
        const amount = veinAlloc.get(rig.id) ?? 0
        if (amount > 0) {
          db.recordPayout({
            epochId: epoch.id,
            wallet: rig.wallet,
            rigId: rig.id,
            kind: 'vein',
            lamports: amount,
          })
        }
      }
      db.resetVein()
      veinPaid = balance
    }
  }

  db.bumpDepth(rigsAfter.map((r) => r.id))

  db.closeEpoch(epoch.id, {
    endedAt: now,
    status: 'resolved',
    strikeSector: strike,
    pot,
    treasury: alloc.treasury,
    veinAdd,
    veinPaid,
    migrationMint: result.migrationMint,
    mintCount: mintRows.length,
    uptimeRatio,
  })

  bus.publish({
    type: 'strike',
    epochId: epoch.id,
    sector: strike,
    pot,
    veinPaid,
    migrationMint: result.migrationMint,
  })
  bus.publish({ type: 'vein', balance: db.veinBalance() })
  bus.publish({ type: 'rift', components: riftComponents(occupied) })

  openNext(now)
}

function openNext(now: number): void {
  const id = db.openEpoch(now)
  bus.publish({ type: 'tick', epochId: id, startedAt: now, endsAt: now + CONFIG.EPOCH_MS })
  bus.publish({ type: 'grade', grades: new Array(CONFIG.SECTOR_COUNT).fill(0) })
}

// --------------------------------------------------------------- payouts

let warnedNoTreasury = false

export async function flushPayouts(): Promise<void> {
  const pending = db.pendingPayouts(10)
  if (pending.length === 0) return

  if (!process.env.TREASURY_SECRET_KEY) {
    if (!warnedNoTreasury) {
      console.warn(
        `[runtime] ${pending.length} payout(s) queued but TREASURY_SECRET_KEY is unset — ` +
          `they stay pending and are visible as pending in the ledger.`,
      )
      warnedNoTreasury = true
    }
    return
  }

  try {
    const signature = await sendBatch(
      pending.map((p) => ({ to: p.wallet, lamports: p.lamports })),
    )
    db.markPayoutSent(
      pending.map((p) => p.id),
      signature,
    )
    console.log(`[runtime] paid ${pending.length} payout(s) in ${signature}`)
  } catch (err) {
    console.error('[runtime] payout batch failed, will retry:', (err as Error).message)
    db.markPayoutFailed(pending.map((p) => p.id))
  }
}

// ------------------------------------------------------------------ boot

export function startRuntime(): void {
  if (globalRef.__pumpjackRuntime) return

  db.getDb()

  const ingest = new Ingest(handleEvent)
  ingest.start()

  const tickTimer = setInterval(() => {
    const now = Date.now()
    const epoch = db.currentEpoch()
    const since = epoch?.started_at ?? now
    try {
      tick(now, ingest.uptimeRatio(since, now))
    } catch (err) {
      console.error('[runtime] tick failed:', (err as Error).message)
    }
  }, TICK_INTERVAL_MS)

  const payoutTimer = setInterval(() => {
    void flushPayouts()
  }, PAYOUT_INTERVAL_MS)

  globalRef.__pumpjackRuntime = { ingest, tickTimer, payoutTimer }
  console.log('[runtime] PUMPJACK online')
}

// ------------------------------------------------------------------ read

export function getState() {
  const epoch = db.currentEpoch()
  const mints = epoch ? db.epochMints(epoch.id) : []
  const { grades } = computeGrades(mints.map(toMintEvent))
  const occupied = db.occupiedSectors()

  return {
    epoch: epoch
      ? {
          id: epoch.id,
          startedAt: epoch.started_at,
          endsAt: epoch.started_at + CONFIG.EPOCH_MS,
        }
      : null,
    grades,
    occupied: [...occupied],
    rifts: riftComponents(occupied),
    rigs: db.activeRigs(),
    vein: db.veinBalance(),
    recentMints: db.recentMints(40),
    recentMigrations: db.recentMigrations(10),
    epochs: db.recentEpochs(20),
    config: {
      gridSize: CONFIG.GRID_SIZE,
      sectorCount: CONFIG.SECTOR_COUNT,
      epochMs: CONFIG.EPOCH_MS,
      drawBps: CONFIG.DRAW_BPS,
      minDeployLamports: CONFIG.MIN_DEPLOY_LAMPORTS,
      depthCap: CONFIG.DEPTH_CAP,
      depthK: CONFIG.DEPTH_K,
    },
    connected: globalRef.__pumpjackRuntime?.ingest.connected ?? false,
  }
}

export type PumpjackState = ReturnType<typeof getState>
