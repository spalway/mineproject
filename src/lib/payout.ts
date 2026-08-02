import { CONFIG } from './config'

export type Rig = {
  id: number
  wallet: string
  sector: number
  /** lamports */
  balance: number
  /** consecutive epochs survived */
  depth: number
}

export type Allocation = {
  treasury: number
  vein: number
  /** rigId -> lamports */
  strikers: Map<number, number>
  /** rigId -> lamports */
  rift: Map<number, number>
  /** lamports routed to the vein because the striking sector was unoccupied */
  veinRollover: number
}

/** Depth multiplies share weight, capped at 3x. */
export function weightOf(rig: Rig): number {
  return rig.balance * (1 + Math.min(rig.depth, CONFIG.DEPTH_CAP) / CONFIG.DEPTH_K)
}

/**
 * Split `total` lamports across `weights` using largest-remainder, so the
 * result sums to `total` EXACTLY. Money is integer lamports end to end —
 * never introduce a float here or the pot stops balancing.
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

/**
 * Split an epoch pot per spec §3.3.
 *
 * The unoccupied-strike path matters more than it looks: the highest-grade
 * sector often holds no rigs at all, and an empty sector belongs to no rift
 * component, so there are no claimants either. That 90% goes to the vein.
 */
export function splitPot(pot: number, strikers: Rig[], claimants: Rig[]): Allocation {
  const treasury = Math.floor((pot * CONFIG.TREASURY_BPS) / 10_000)
  const vein = Math.floor((pot * CONFIG.VEIN_BPS) / 10_000)
  const distributable = pot - treasury - vein

  const strikerMap = new Map<number, number>()
  const riftMap = new Map<number, number>()

  if (strikers.length === 0) {
    return { treasury, vein, strikers: strikerMap, rift: riftMap, veinRollover: distributable }
  }

  let riftPool = 0
  if (claimants.length > 0) {
    riftPool = Math.min(Math.floor((pot * CONFIG.RIFT_BPS) / 10_000), distributable)
  }
  const strikerPool = distributable - riftPool

  const strikerAlloc = allocate(strikerPool, strikers.map(weightOf))
  strikers.forEach((r, i) => strikerMap.set(r.id, strikerAlloc[i]))

  const riftAlloc = allocate(riftPool, claimants.map(weightOf))
  claimants.forEach((r, i) => riftMap.set(r.id, riftAlloc[i]))

  return { treasury, vein, strikers: strikerMap, rift: riftMap, veinRollover: 0 }
}

/** The vein belongs to strikers alone. Rift claimants never draw from it. */
export function splitVein(veinBalance: number, strikers: Rig[]): Map<number, number> {
  const out = new Map<number, number>()
  if (strikers.length === 0) return out
  const alloc = allocate(veinBalance, strikers.map(weightOf))
  strikers.forEach((r, i) => out.set(r.id, alloc[i]))
  return out
}

/** Lamports burned from a rig into the pot this epoch. */
export function drawOf(balance: number): number {
  return Math.floor((balance * CONFIG.DRAW_BPS) / 10_000)
}
