import { CONFIG } from './config'

export type Spot = {
  id: number
  wallet: string
  sector: number
  /** consecutive rounds held */
  depth: number
  /** token balance at last check, for display and eligibility */
  tokens: number
}

export type Allocation = {
  /** spotId -> lamports */
  strike: Map<number, number>
  rift: Map<number, number>
  pool: Map<number, number>
  /** lamports with nowhere to go, carried into the next round */
  carried: number
}

/**
 * Depth multiplies share weight up to 3x. There is no stake, so weight comes
 * purely from how long a spot has been held — churning your spot costs you.
 */
export function weightOf(spot: Spot): number {
  return 1 + Math.min(spot.depth, CONFIG.DEPTH_CAP) / CONFIG.DEPTH_K
}

/**
 * Split `total` lamports across `weights` using largest-remainder, so the
 * result sums to `total` EXACTLY. Money is integer lamports end to end.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0 || total <= 0) return weights.map(() => 0)

  const exact = weights.map((w) => (total * w) / sum)
  const out = exact.map(Math.floor)

  let remainder = total - out.reduce((a, b) => a + b, 0)
  const byFraction = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)

  for (let k = 0; k < byFraction.length && remainder > 0; k++, remainder--) {
    out[byFraction[k].i]++
  }
  return out
}

function distribute(total: number, spots: Spot[], into: Map<number, number>): void {
  const alloc = allocate(total, spots.map(weightOf))
  spots.forEach((s, i) => into.set(s.id, alloc[i]))
}

/**
 * Split a round pot.
 *
 * `strikers` hold the sector that graded highest, `claimants` are within two
 * hops of it along a rift, and `everyone` is every live spot including the
 * first two groups — the pool share is the baseline that makes this a pool
 * rather than a lottery.
 *
 * Any share with no eligible recipients is carried into the next round rather
 * than silently vanishing.
 */
export function splitPot(
  pot: number,
  strikers: Spot[],
  claimants: Spot[],
  everyone: Spot[],
): Allocation {
  const strike = new Map<number, number>()
  const rift = new Map<number, number>()
  const pool = new Map<number, number>()

  const strikeShare = Math.floor((pot * CONFIG.STRIKE_BPS) / 10_000)
  const riftShare = Math.floor((pot * CONFIG.RIFT_BPS) / 10_000)
  // Pool absorbs the rounding dust so the three shares reconstruct the pot.
  const poolShare = Math.max(0, pot - strikeShare - riftShare)

  let carried = 0

  if (strikers.length > 0) distribute(strikeShare, strikers, strike)
  else carried += strikeShare

  if (claimants.length > 0) distribute(riftShare, claimants, rift)
  else carried += riftShare

  if (everyone.length > 0) distribute(poolShare, everyone, pool)
  else carried += poolShare

  return { strike, rift, pool, carried }
}

/** Total owed per spot across all three shares. */
export function totalPerSpot(alloc: Allocation): Map<number, number> {
  const out = new Map<number, number>()
  for (const m of [alloc.strike, alloc.rift, alloc.pool]) {
    for (const [id, amount] of m) out.set(id, (out.get(id) ?? 0) + amount)
  }
  return out
}

/** Share of newly accrued creator fees that flows into a round pot. */
export function feeShare(accrued: number): number {
  if (accrued <= 0) return 0
  return Math.floor((accrued * CONFIG.FEE_SHARE_BPS) / 10_000)
}
