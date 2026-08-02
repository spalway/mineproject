import { CONFIG } from './config'
import { bus } from './bus'
import { Ingest, type ParsedEvent } from './ingest'
import * as db from './db'
import { resolveRound, computeGrades, type MintEvent } from './engine'
import { riftClaimants, riftComponents } from './rift'
import { splitPot, feeShare, weightOf, type Spot } from './payout'
import { tokenBalance, treasuryBalance, getTokenMint, getTreasuryAddress } from './chain'

/**
 * Owns the websocket and the round clock. Boots once per server process from
 * instrumentation.ts.
 *
 * There is no payout loop, because the server cannot move funds. Rounds
 * compute what each wallet is OWED and write it to a public ledger, and
 * settlement is done by hand.
 */

const TICK_INTERVAL_MS = 2_000

type Runtime = {
  ingest: Ingest
  tickTimer: NodeJS.Timeout
}

const globalRef = globalThis as unknown as { __nodeiRuntime?: Runtime }

const toMintEvent = (r: db.MintRow): MintEvent => ({
  mint: r.mint,
  sector: r.sector,
  creator: r.creator ?? '',
  receivedAt: r.received_at,
})

// ------------------------------------------------------------------ feed

function handleEvent(e: ParsedEvent): void {
  const round = db.currentRound()
  if (!round) return

  const at = Date.now()

  if (e.kind === 'mint') {
    db.insertMint({
      mint: e.mint,
      sector: e.sector,
      roundId: round.id,
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
    db.insertMigration({ mint: e.mint, sector: e.sector, roundId: round.id, receivedAt: at })
    bus.publish({ type: 'migration', mint: e.mint, sector: e.sector, at })
  }

  const { grades } = computeGrades(db.roundMints(round.id).map(toMintEvent))
  bus.publish({ type: 'grade', grades })
}

// ---------------------------------------------------------------- rounds

/**
 * Re-check that every live spot still holds the minimum. Selling below the
 * threshold releases the spot at the next round boundary rather than at sale
 * time, because chain state is only read on the boundary.
 */
async function reconcileHoldings(roundId: number): Promise<Spot[]> {
  const spots = db.liveSpots()
  if (!getTokenMint()) return spots

  const kept: Spot[] = []
  for (const spot of spots) {
    const tokens = await tokenBalance(spot.wallet)
    db.setSpotTokens(spot.id, tokens)

    if (tokens < CONFIG.MIN_TOKEN_BALANCE) {
      db.releaseSpot(spot.id, roundId, 'below minimum balance')
      bus.publish({ type: 'release', wallet: spot.wallet, sector: spot.sector })
    } else {
      kept.push({ ...spot, tokens })
    }
  }
  return kept
}

/**
 * Resolve the open round if it is due, then open the next one.
 * Exported separately from the timer so tests can drive it directly.
 */
export async function tick(
  now: number,
  uptimeRatio: number,
  treasury: number | null,
): Promise<void> {
  const round = db.currentRound()

  if (!round) {
    const id = db.openRound(now)
    bus.publish({ type: 'tick', roundId: id, startedAt: now, endsAt: now + CONFIG.ROUND_MS })
    return
  }

  if (now < round.started_at + CONFIG.ROUND_MS) return

  const mintRows = db.roundMints(round.id)
  const result = resolveRound({
    mints: mintRows.map(toMintEvent),
    migrations: db.roundMigrations(round.id),
    uptimeRatio,
  })

  const countedSet = new Set(result.countedMints.map((m) => m.mint))
  db.markUncounted(mintRows.filter((m) => !countedSet.has(m.mint)).map((m) => m.mint))

  const spots = await reconcileHoldings(round.id)

  // Fees accrued since the last close. A withdrawal makes the delta negative,
  // in which case the round simply has no new fees rather than a negative pot.
  const last = db.getLastTreasury()
  const accrued = treasury !== null && last !== null ? Math.max(0, treasury - last) : 0
  if (treasury !== null) db.setLastTreasury(treasury)

  const carried = db.getCarried()
  const pot = feeShare(accrued) + carried

  if (result.status === 'void') {
    // Nothing distributed and nothing lost: the pot rolls forward whole and
    // depth still accrues. We never invent data to cover a feed gap.
    db.bumpDepth(spots.map((s) => s.id))
    db.setCarried(pot)
    db.closeRound(round.id, {
      endedAt: now,
      status: 'void',
      strikeSector: null,
      pot: 0,
      carried: pot,
      feeAccrued: accrued,
      treasury: treasury ?? 0,
      migrationMint: null,
      mintCount: mintRows.length,
      uptimeRatio,
    })
    bus.publish({ type: 'void', roundId: round.id, uptimeRatio })
    openNext(now)
    return
  }

  const occupied = db.occupiedSectors()
  const strike = result.strikeSector

  const strikers = strike === null ? [] : spots.filter((s) => s.sector === strike)
  const claimantSectors = strike === null ? [] : riftClaimants(strike, occupied)
  const claimants = spots.filter((s) => claimantSectors.includes(s.sector))

  const alloc = splitPot(pot, strikers, claimants, spots)

  for (const [kind, map] of [
    ['strike', alloc.strike],
    ['rift', alloc.rift],
    ['pool', alloc.pool],
  ] as const) {
    for (const [spotId, lamports] of map) {
      if (lamports <= 0) continue
      const spot = spots.find((s) => s.id === spotId)
      if (!spot) continue
      db.recordPayout({ roundId: round.id, wallet: spot.wallet, spotId, kind, lamports })
    }
  }

  db.setCarried(alloc.carried)
  db.bumpDepth(spots.map((s) => s.id))

  db.closeRound(round.id, {
    endedAt: now,
    status: 'resolved',
    strikeSector: strike,
    pot,
    carried: alloc.carried,
    feeAccrued: accrued,
    treasury: treasury ?? 0,
    migrationMint: result.migrationMint,
    mintCount: mintRows.length,
    uptimeRatio,
  })

  bus.publish({
    type: 'strike',
    roundId: round.id,
    sector: strike,
    pot,
    migrationMint: result.migrationMint,
  })
  bus.publish({ type: 'rift', components: riftComponents(occupied) })

  openNext(now)
}

function openNext(now: number): void {
  const id = db.openRound(now)
  bus.publish({ type: 'tick', roundId: id, startedAt: now, endsAt: now + CONFIG.ROUND_MS })
  bus.publish({ type: 'grade', grades: new Array(CONFIG.SECTOR_COUNT).fill(0) })
}

// ------------------------------------------------------------------ boot

export function startRuntime(): void {
  if (globalRef.__nodeiRuntime) return

  db.getDb()

  /**
   * Take a baseline treasury reading immediately. Without it the first round
   * has nothing to measure against and would pay nothing, and the balance
   * would read "--" until the first close ten minutes later.
   *
   * Only set it when absent: on a restart the existing mark must survive, or
   * fees that accrued while the process was down would be erased.
   */
  void treasuryBalance().then((balance) => {
    if (balance !== null && db.getLastTreasury() === null) {
      db.setLastTreasury(balance)
      console.log(`[runtime] treasury baseline ${balance} lamports`)
    }
  })

  const ingest = new Ingest(handleEvent)
  ingest.start()

  let ticking = false
  const tickTimer = setInterval(() => {
    if (ticking) return
    ticking = true

    const now = Date.now()
    const round = db.currentRound()
    const since = round?.started_at ?? now

    // Only spend an RPC read when a round is actually due to close.
    const due = round !== undefined && now >= round.started_at + CONFIG.ROUND_MS

    void (due ? treasuryBalance() : Promise.resolve(null))
      .then((treasury) => tick(now, ingest.uptimeRatio(since, now), treasury))
      .catch((err) => console.error('[runtime] tick failed:', (err as Error).message))
      .finally(() => {
        ticking = false
      })
  }, TICK_INTERVAL_MS)

  globalRef.__nodeiRuntime = { ingest, tickTimer }
  console.log('[runtime] nodei online')
}

// ------------------------------------------------------------------ read

export function getState() {
  const round = db.currentRound()
  const mints = round ? db.roundMints(round.id) : []
  const { grades } = computeGrades(mints.map(toMintEvent))
  const occupied = db.occupiedSectors()
  const spots = db.liveSpots()

  const totalWeight = spots.reduce((sum, s) => sum + weightOf(s), 0)

  const sectors = Array.from({ length: CONFIG.SECTOR_COUNT }, (_, sector) => {
    const holder = spots.find((s) => s.sector === sector)
    return {
      sector,
      grade: grades[sector] ?? 0,
      claimed: !!holder,
      wallet: holder?.wallet ?? null,
      depth: holder?.depth ?? 0,
      weight: holder ? weightOf(holder) : 0,
      /** this holder's fraction of the pool leg */
      poolShare: holder && totalWeight > 0 ? weightOf(holder) / totalWeight : 0,
    }
  })

  return {
    sectors,
    round: round
      ? { id: round.id, startedAt: round.started_at, endsAt: round.started_at + CONFIG.ROUND_MS }
      : null,
    grades,
    occupied: [...occupied],
    rifts: riftComponents(occupied),
    spots,
    carried: db.getCarried(),
    owed: db.totalOwed(),
    paid: db.totalPaid(),
    leaderboard: db.owedByWallet().slice(0, 20),
    recentMints: db.recentMints(40),
    recentMigrations: db.recentMigrations(10),
    rounds: db.recentRounds(20),
    treasury: {
      address: getTreasuryAddress(),
      lastSeen: db.getLastTreasury(),
    },
    config: {
      gridSize: CONFIG.GRID_SIZE,
      sectorCount: CONFIG.SECTOR_COUNT,
      roundMs: CONFIG.ROUND_MS,
      minTokens: CONFIG.MIN_TOKEN_BALANCE,
      feeShareBps: CONFIG.FEE_SHARE_BPS,
      strikeBps: CONFIG.STRIKE_BPS,
      riftBps: CONFIG.RIFT_BPS,
      poolBps: CONFIG.POOL_BPS,
      depthCap: CONFIG.DEPTH_CAP,
      depthK: CONFIG.DEPTH_K,
      tokenMint: getTokenMint(),
    },
    connected: globalRef.__nodeiRuntime?.ingest.connected ?? false,
  }
}

export type NodeiState = ReturnType<typeof getState>
