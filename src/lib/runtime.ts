import { CONFIG } from './config'
import { bus } from './bus'
import { Ingest, type ParsedEvent } from './ingest'
import { getStore } from './store'
import type { MintRow } from './store/types'
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
 * settlement is done separately.
 */

const TICK_INTERVAL_MS = 2_000

type Runtime = {
  ingest: Ingest
  tickTimer: NodeJS.Timeout
}

const globalRef = globalThis as unknown as { __nodeiRuntime?: Runtime }

const toMintEvent = (r: MintRow): MintEvent => ({
  mint: r.mint,
  sector: r.sector,
  creator: r.creator ?? '',
  receivedAt: r.received_at,
})

// ------------------------------------------------------------------ feed

async function handleEvent(e: ParsedEvent): Promise<void> {
  const store = getStore()
  const round = await store.currentRound()
  if (!round) return

  const at = Date.now()

  if (e.kind === 'mint') {
    await store.insertMint({
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
    await store.insertMigration({
      mint: e.mint,
      sector: e.sector,
      roundId: round.id,
      receivedAt: at,
    })
    bus.publish({ type: 'migration', mint: e.mint, sector: e.sector, at })
  }

  const { grades } = computeGrades((await store.roundMints(round.id)).map(toMintEvent))
  bus.publish({ type: 'grade', grades })
}

// ---------------------------------------------------------------- rounds

/**
 * Re-check that every live spot still holds the minimum. Selling below the
 * threshold releases the spot at the next round boundary rather than at sale
 * time, because chain state is only read on the boundary.
 */
async function reconcileHoldings(roundId: number): Promise<Spot[]> {
  const store = getStore()
  const spots = await store.liveSpots()
  if (!(await getTokenMint())) return spots

  const kept: Spot[] = []
  for (const spot of spots) {
    const tokens = await tokenBalance(spot.wallet)
    await store.setSpotTokens(spot.id, tokens)

    if (tokens < CONFIG.MIN_TOKEN_BALANCE) {
      await store.releaseSpot(spot.id, roundId, 'below minimum balance')
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
  const store = getStore()
  const round = await store.currentRound()

  if (!round) {
    const id = await store.openRound(now)
    bus.publish({ type: 'tick', roundId: id, startedAt: now, endsAt: now + CONFIG.ROUND_MS })
    return
  }

  /**
   * When the token goes live mid-round, restart the clock so the first
   * claimable round runs its full length. Without this the CA could land with
   * seconds left and the opening round would close before anyone could claim.
   */
  const mint = await getTokenMint()
  const seen = await store.metaGet('last_seen_mint')
  if (mint && mint !== seen) {
    await store.metaSet('last_seen_mint', mint)
    await store.resetRoundStart(round.id, now)
    bus.publish({
      type: 'tick',
      roundId: round.id,
      startedAt: now,
      endsAt: now + CONFIG.ROUND_MS,
    })
    console.log(`[runtime] token live, round ${round.id} restarted at full length`)
    return
  }

  if (now < round.started_at + CONFIG.ROUND_MS) return

  const mintRows = await store.roundMints(round.id)
  const result = resolveRound({
    mints: mintRows.map(toMintEvent),
    migrations: await store.roundMigrations(round.id),
    uptimeRatio,
  })

  const countedSet = new Set(result.countedMints.map((m) => m.mint))
  await store.markUncounted(mintRows.filter((m) => !countedSet.has(m.mint)).map((m) => m.mint))

  const spots = await reconcileHoldings(round.id)

  // Fees accrued since the last close. A withdrawal makes the delta negative,
  // in which case the round simply has no new fees rather than a negative pot.
  const last = await store.getLastTreasury()
  const accrued = treasury !== null && last !== null ? Math.max(0, treasury - last) : 0
  if (treasury !== null) await store.setLastTreasury(treasury)

  const carried = await store.getCarried()
  const pot = feeShare(accrued) + carried

  if (result.status === 'void') {
    // Nothing distributed and nothing lost: the pot rolls forward whole and
    // depth still accrues. We never invent data to cover a feed gap.
    await store.bumpDepth(spots.map((s) => s.id))
    await store.setCarried(pot)
    await store.closeRound(round.id, {
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
    await openNext(now)
    return
  }

  const occupied = await store.occupiedSectors()
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
      await store.recordPayout({
        roundId: round.id,
        wallet: spot.wallet,
        spotId,
        kind,
        lamports,
      })
    }
  }

  await store.setCarried(alloc.carried)
  await store.bumpDepth(spots.map((s) => s.id))

  await store.closeRound(round.id, {
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

  await openNext(now)
}

async function openNext(now: number): Promise<void> {
  const id = await getStore().openRound(now)
  bus.publish({ type: 'tick', roundId: id, startedAt: now, endsAt: now + CONFIG.ROUND_MS })
  bus.publish({ type: 'grade', grades: new Array(CONFIG.SECTOR_COUNT).fill(0) })
}

// ------------------------------------------------------------------ boot

export function startRuntime(): void {
  if (globalRef.__nodeiRuntime) return

  const store = getStore()

  void store
    .ready()
    .then(async () => {
      /**
       * Take a baseline treasury reading immediately. Without it the first
       * round has nothing to measure against and would pay nothing, and the
       * balance would read blank until the first close.
       *
       * Only set it when absent: on a restart the existing mark must survive,
       * or fees that accrued while the process was down would be erased.
       */
      const balance = await treasuryBalance()
      if (balance !== null && (await store.getLastTreasury()) === null) {
        await store.setLastTreasury(balance)
        console.log(`[runtime] treasury baseline ${balance} lamports`)
      }
    })
    .catch((err) => console.error('[runtime] store init failed:', (err as Error).message))

  const ingest = new Ingest((e) => {
    void handleEvent(e).catch((err) =>
      console.error('[runtime] event failed:', (err as Error).message),
    )
  })
  ingest.start()

  let ticking = false
  const tickTimer = setInterval(() => {
    if (ticking) return
    ticking = true

    void (async () => {
      try {
        const now = Date.now()
        const round = await store.currentRound()
        const since = round?.started_at ?? now

        // Only spend an RPC read when a round is actually due to close.
        const due = round !== undefined && now >= round.started_at + CONFIG.ROUND_MS
        const treasury = due ? await treasuryBalance() : null

        await tick(now, ingest.uptimeRatio(since, now), treasury)
      } catch (err) {
        console.error('[runtime] tick failed:', (err as Error).message)
      } finally {
        ticking = false
      }
    })()
  }, TICK_INTERVAL_MS)

  globalRef.__nodeiRuntime = { ingest, tickTimer }
  console.log(`[runtime] nodei online (${store.kind})`)
}

// ------------------------------------------------------------------ read

export async function getState() {
  const store = getStore()

  const round = await store.currentRound()
  const mints = round ? await store.roundMints(round.id) : []
  const { grades } = computeGrades(mints.map(toMintEvent))
  const occupied = await store.occupiedSectors()
  const spots = await store.liveSpots()

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

  const [carried, owed, paid, leaderboard, recentMints, recentMigrations, rounds, lastSeen] =
    await Promise.all([
      store.getCarried(),
      store.totalOwed(),
      store.totalPaid(),
      store.owedByWallet(),
      store.recentMints(40),
      store.recentMigrations(10),
      store.recentRounds(20),
      store.getLastTreasury(),
    ])

  return {
    sectors,
    round: round
      ? { id: round.id, startedAt: round.started_at, endsAt: round.started_at + CONFIG.ROUND_MS }
      : null,
    grades,
    occupied: [...occupied],
    rifts: riftComponents(occupied),
    spots,
    carried,
    owed,
    paid,
    leaderboard: leaderboard.slice(0, 20),
    recentMints,
    recentMigrations,
    rounds,
    treasury: {
      address: await getTreasuryAddress(),
      lastSeen,
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
      tokenMint: await getTokenMint(),
    },
    storage: store.kind,
    connected: globalRef.__nodeiRuntime?.ingest.connected ?? false,
  }
}

export type NodeiState = Awaited<ReturnType<typeof getState>>
