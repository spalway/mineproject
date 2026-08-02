/**
 * Every tunable in one place. Values come from the design spec §3.8.
 * Nothing else in the codebase may hardcode a mechanic constant.
 */
export const CONFIG = {
  /** Field is GRID_SIZE x GRID_SIZE. */
  GRID_SIZE: 8,
  SECTOR_COUNT: 64,

  /**
   * One epoch of the field.
   *
   * Calibrated against a real 240s capture: pump.fun emits ~13.3 mints/min, so
   * a 60s epoch over 64 sectors leaves 29% of epochs with a winning grade of 1
   * — the strike collapses to "whoever caught the first mint" and the grid
   * stops mattering. At 120s that drops to 1.4%. See scripts/analyze-rate.mjs.
   */
  EPOCH_MS: 120_000,

  /** Fraction of a rig's balance burned into the pot each epoch. */
  DRAW_BPS: 100,

  /** Pot split. Must total 10_000. */
  TREASURY_BPS: 400,
  VEIN_BPS: 600,
  STRIKER_BPS: 7_500,
  RIFT_BPS: 1_500,
  /** Strikers absorb the rift share when no claimants exist. */
  STRIKER_BPS_NO_RIFT: 9_000,

  /** Hops a rift claim propagates from the striking sector. */
  RIFT_MAX_DISTANCE: 2,

  /**
   * Depth accrual. weight = balance * (1 + min(depth, CAP) / K), so the
   * multiplier tops out at 3x after DEPTH_CAP epochs. At DRAW_BPS=100 a rig
   * halves in ~69 epochs, so max weight lands just before holding gets
   * expensive. Tune these two together or the incentive breaks.
   */
  DEPTH_CAP: 60,
  DEPTH_K: 30,

  /** Feed downtime past this fraction of an epoch voids it. */
  VOID_THRESHOLD: 0.2,

  MIN_DEPLOY_LAMPORTS: 10_000_000,

  /** Memo prefix. Full form is `ND1:<sector>`. */
  MEMO_TAG: 'ND1',
} as const

export const LAMPORTS_PER_SOL = 1_000_000_000
