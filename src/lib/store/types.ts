import type { Spot } from '../payout'

/**
 * The data layer, as an interface.
 *
 * Everything is async because Postgres is. The SQLite implementation is
 * synchronous underneath and simply resolves immediately — that keeps the
 * mechanic tests running offline while production talks to Supabase.
 */

export type RoundRow = {
  id: number
  started_at: number
  ended_at: number | null
  status: string
  strike_sector: number | null
  pot_lamports: number
  carried_lamports: number
  fee_accrued_lamports: number
  treasury_lamports: number
  migration_mint: string | null
  mint_count: number
  uptime_ratio: number
}

export type MintRow = {
  mint: string
  sector: number
  round_id: number
  received_at: number
  name: string | null
  symbol: string | null
  uri: string | null
  creator: string | null
  counted: number | boolean
}

export type PayoutRow = {
  id: number
  round_id: number
  wallet: string
  spot_id: number | null
  kind: string
  lamports: number
  status: string
  signature: string | null
}

export type CloseRoundInput = {
  endedAt: number
  status: 'resolved' | 'void'
  strikeSector: number | null
  pot: number
  carried: number
  feeAccrued: number
  treasury: number
  migrationMint: string | null
  mintCount: number
  uptimeRatio: number
}

export type Store = {
  /** Human label for logs and the health endpoint. */
  readonly kind: 'sqlite' | 'supabase'
  ready(): Promise<void>

  // config
  configGet(key: string): Promise<string | null>
  configSet(key: string, value: string): Promise<void>

  // internal key/value, distinct from operator-facing config
  metaGet(key: string): Promise<string | null>
  metaSet(key: string, value: string): Promise<void>

  // internal runtime state
  getCarried(): Promise<number>
  setCarried(n: number): Promise<void>
  getLastTreasury(): Promise<number | null>
  setLastTreasury(n: number): Promise<void>

  // rounds
  openRound(startedAt: number): Promise<number>
  currentRound(): Promise<RoundRow | undefined>
  getRound(id: number): Promise<RoundRow | undefined>
  closeRound(id: number, f: CloseRoundInput): Promise<void>
  resetRoundStart(id: number, startedAt: number): Promise<void>
  recentRounds(limit?: number): Promise<RoundRow[]>

  // feed
  insertMint(m: {
    mint: string
    sector: number
    roundId: number
    receivedAt: number
    name?: string | null
    symbol?: string | null
    uri?: string | null
    creator?: string | null
  }): Promise<void>
  insertMigration(g: {
    mint: string
    sector: number
    roundId: number
    receivedAt: number
  }): Promise<void>
  roundMints(roundId: number): Promise<MintRow[]>
  roundMigrations(roundId: number): Promise<{ mint: string; sector: number }[]>
  markUncounted(mints: string[]): Promise<void>
  recentMints(limit?: number): Promise<MintRow[]>
  recentMigrations(
    limit?: number,
  ): Promise<{ mint: string; sector: number; received_at: number }[]>

  // spots
  claimSpot(s: {
    wallet: string
    sector: number
    tokens: number
    round: number
  }): Promise<number>
  releaseSpot(id: number, round: number, reason: string): Promise<void>
  liveSpots(): Promise<Spot[]>
  spotByWallet(wallet: string): Promise<(Spot & { status: string }) | undefined>
  getSpot(id: number): Promise<(Spot & { status: string }) | undefined>
  sectorTaken(sector: number): Promise<boolean>
  bumpDepth(ids: number[]): Promise<void>
  setSpotTokens(id: number, tokens: number): Promise<void>
  occupiedSectors(): Promise<Set<number>>
  spotsDuringRound(
    roundId: number,
  ): Promise<{ id: number; wallet: string; sector: number }[]>

  // payouts
  recordPayout(p: {
    roundId: number
    wallet: string
    spotId: number | null
    kind: 'strike' | 'rift' | 'pool'
    lamports: number
  }): Promise<void>
  owedByWallet(): Promise<{ wallet: string; lamports: number; rounds: number }[]>
  walletPayouts(wallet: string, limit?: number): Promise<PayoutRow[]>
  roundPayouts(roundId: number): Promise<PayoutRow[]>
  totalOwed(): Promise<number>
  totalPaid(): Promise<number>

  // nonces
  issueNonce(wallet: string, nonce: string): Promise<void>
  consumeNonce(wallet: string, nonce: string): Promise<boolean>
}
