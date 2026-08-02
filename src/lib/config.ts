/**
 * Every tunable in one place. Nothing else may hardcode a mechanic constant.
 */
export const CONFIG = {
  /** Field is GRID_SIZE x GRID_SIZE. */
  GRID_SIZE: 8,
  SECTOR_COUNT: 64,

  /** One pool round. */
  ROUND_MS: 600_000,

  /**
   * Share of newly accrued creator fees that flows to the pool each round.
   * This is an operator policy, not an on-chain rule — the site says so.
   */
  FEE_SHARE_BPS: 7_000,

  /** Minimum token balance required to hold a spot. Re-checked every round. */
  MIN_TOKEN_BALANCE: 10_000,

  /**
   * Round pot split. Must total 10_000.
   * Everyone with a live spot earns something (it is a pool), but position
   * still decides most of it (it is a field).
   */
  STRIKE_BPS: 5_000,
  RIFT_BPS: 2_000,
  POOL_BPS: 3_000,

  /** Hops a rift claim propagates from the striking sector. */
  RIFT_MAX_DISTANCE: 2,

  /**
   * Depth accrual. weight = 1 + min(depth, CAP) / K, so a spot held through
   * 36 rounds (six hours) carries 3x the weight of one claimed this round.
   * Costs nothing to accrue — it only rewards not churning your spot.
   */
  DEPTH_CAP: 36,
  DEPTH_K: 18,

  /** Feed downtime past this fraction of a round voids it. */
  VOID_THRESHOLD: 0.2,

  /** One spot per wallet. */
  MAX_SPOTS_PER_WALLET: 1,
} as const

export const LAMPORTS_PER_SOL = 1_000_000_000
