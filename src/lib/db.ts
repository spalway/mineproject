import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Spot } from './payout'

/**
 * Storage uses Node's first-party `node:sqlite` — same synchronous shape as
 * better-sqlite3 with no native compile step.
 *
 * All money columns are INTEGER lamports. Never store money as REAL.
 */

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS rounds (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at           INTEGER NOT NULL,
  ended_at             INTEGER,
  status               TEXT    NOT NULL DEFAULT 'open',
  strike_sector        INTEGER,
  pot_lamports         INTEGER NOT NULL DEFAULT 0,
  carried_lamports     INTEGER NOT NULL DEFAULT 0,
  fee_accrued_lamports INTEGER NOT NULL DEFAULT 0,
  treasury_lamports    INTEGER NOT NULL DEFAULT 0,
  migration_mint       TEXT,
  mint_count           INTEGER NOT NULL DEFAULT 0,
  uptime_ratio         REAL    NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mints (
  mint        TEXT PRIMARY KEY,
  sector      INTEGER NOT NULL,
  round_id    INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  name        TEXT,
  symbol      TEXT,
  uri         TEXT,
  creator     TEXT,
  counted     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_mints_round ON mints(round_id);

CREATE TABLE IF NOT EXISTS migrations (
  mint        TEXT PRIMARY KEY,
  sector      INTEGER NOT NULL,
  round_id    INTEGER NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_migrations_round ON migrations(round_id);

-- One live spot per wallet is enforced by the partial unique index below.
CREATE TABLE IF NOT EXISTS spots (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet         TEXT    NOT NULL,
  sector         INTEGER NOT NULL,
  depth          INTEGER NOT NULL DEFAULT 0,
  tokens         REAL    NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'live',
  claimed_round  INTEGER NOT NULL,
  released_round INTEGER,
  released_reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_spots_one_per_wallet
  ON spots(wallet) WHERE status = 'live';
CREATE INDEX IF NOT EXISTS idx_spots_status ON spots(status);

CREATE TABLE IF NOT EXISTS payouts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id  INTEGER NOT NULL,
  wallet    TEXT    NOT NULL,
  spot_id   INTEGER,
  kind      TEXT    NOT NULL,
  lamports  INTEGER NOT NULL,
  status    TEXT    NOT NULL DEFAULT 'owed',
  signature TEXT,
  paid_at   INTEGER,
  UNIQUE (round_id, spot_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_wallet ON payouts(wallet);

CREATE TABLE IF NOT EXISTS nonces (
  nonce      TEXT PRIMARY KEY,
  wallet     TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

let handle: DatabaseSync | null = null

export function getDb(path?: string, opts?: { reset?: boolean }): DatabaseSync {
  if (handle && !opts?.reset) return handle
  if (handle && opts?.reset) {
    handle.close()
    handle = null
  }

  const target = path ?? process.env.NODEI_DB ?? '.data/nodei.db'
  if (target !== ':memory:') mkdirSync(dirname(target), { recursive: true })

  handle = new DatabaseSync(target)
  handle.exec(SCHEMA)
  return handle
}

// ------------------------------------------------------------------ meta

export function metaGet(key: string): string | null {
  const r = getDb().prepare('SELECT value FROM meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return r?.value ?? null
}

export function metaSet(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
    .run(key, value, value)
}

export const getCarried = (): number => Number(metaGet('carried') ?? 0)
export const setCarried = (n: number): void => metaSet('carried', String(n))

/** Treasury lamports observed at the last round close, for fee-delta maths. */
export const getLastTreasury = (): number | null => {
  const v = metaGet('last_treasury')
  return v === null ? null : Number(v)
}
export const setLastTreasury = (n: number): void => metaSet('last_treasury', String(n))

// ---------------------------------------------------------------- rounds

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

export function openRound(startedAt: number): number {
  const r = getDb().prepare('INSERT INTO rounds (started_at) VALUES (?)').run(startedAt)
  return Number(r.lastInsertRowid)
}

export function currentRound(): RoundRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM rounds WHERE status = 'open' ORDER BY id DESC LIMIT 1`)
    .get() as RoundRow | undefined
}

export function closeRound(
  id: number,
  f: {
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
  },
): void {
  getDb()
    .prepare(
      `UPDATE rounds SET ended_at=?, status=?, strike_sector=?, pot_lamports=?,
       carried_lamports=?, fee_accrued_lamports=?, treasury_lamports=?,
       migration_mint=?, mint_count=?, uptime_ratio=? WHERE id=?`,
    )
    .run(
      f.endedAt,
      f.status,
      f.strikeSector,
      f.pot,
      f.carried,
      f.feeAccrued,
      f.treasury,
      f.migrationMint,
      f.mintCount,
      f.uptimeRatio,
      id,
    )
}

export function recentRounds(limit = 30): RoundRow[] {
  return getDb()
    .prepare(`SELECT * FROM rounds WHERE status != 'open' ORDER BY id DESC LIMIT ?`)
    .all(limit) as RoundRow[]
}

// ------------------------------------------------------------------ feed

export type MintRow = {
  mint: string
  sector: number
  round_id: number
  received_at: number
  name: string | null
  symbol: string | null
  uri: string | null
  creator: string | null
  counted: number
}

export function insertMint(m: {
  mint: string
  sector: number
  roundId: number
  receivedAt: number
  name?: string | null
  symbol?: string | null
  uri?: string | null
  creator?: string | null
}): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO mints (mint, sector, round_id, received_at, name, symbol, uri, creator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      m.mint,
      m.sector,
      m.roundId,
      m.receivedAt,
      m.name ?? null,
      m.symbol ?? null,
      m.uri ?? null,
      m.creator ?? null,
    )
}

export function insertMigration(g: {
  mint: string
  sector: number
  roundId: number
  receivedAt: number
}): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO migrations (mint, sector, round_id, received_at) VALUES (?, ?, ?, ?)`,
    )
    .run(g.mint, g.sector, g.roundId, g.receivedAt)
}

export function roundMints(roundId: number): MintRow[] {
  return getDb()
    .prepare('SELECT * FROM mints WHERE round_id = ? ORDER BY received_at ASC')
    .all(roundId) as MintRow[]
}

export function roundMigrations(roundId: number): { mint: string; sector: number }[] {
  return getDb()
    .prepare('SELECT mint, sector FROM migrations WHERE round_id = ?')
    .all(roundId) as { mint: string; sector: number }[]
}

/** Flag mints the per-creator cap excluded, so the cap stays auditable. */
export function markUncounted(mints: string[]): void {
  if (mints.length === 0) return
  const marks = mints.map(() => '?').join(',')
  getDb().prepare(`UPDATE mints SET counted = 0 WHERE mint IN (${marks})`).run(...mints)
}

export function recentMints(limit = 50): MintRow[] {
  return getDb()
    .prepare('SELECT * FROM mints ORDER BY received_at DESC LIMIT ?')
    .all(limit) as MintRow[]
}

export function recentMigrations(
  limit = 20,
): { mint: string; sector: number; received_at: number }[] {
  return getDb()
    .prepare('SELECT mint, sector, received_at FROM migrations ORDER BY received_at DESC LIMIT ?')
    .all(limit) as { mint: string; sector: number; received_at: number }[]
}

// ----------------------------------------------------------------- spots

type SpotRow = {
  id: number
  wallet: string
  sector: number
  depth: number
  tokens: number
  status: string
  claimed_round: number
  released_round: number | null
  released_reason: string | null
}

const toSpot = (r: SpotRow): Spot => ({
  id: r.id,
  wallet: r.wallet,
  sector: r.sector,
  depth: r.depth,
  tokens: r.tokens,
})

/** Throws if the wallet already holds a live spot (unique index). */
export function claimSpot(s: {
  wallet: string
  sector: number
  tokens: number
  round: number
}): number {
  const res = getDb()
    .prepare(
      `INSERT INTO spots (wallet, sector, tokens, claimed_round) VALUES (?, ?, ?, ?)`,
    )
    .run(s.wallet, s.sector, s.tokens, s.round)
  return Number(res.lastInsertRowid)
}

export function releaseSpot(id: number, round: number, reason: string): void {
  getDb()
    .prepare(
      `UPDATE spots SET status='released', released_round=?, released_reason=? WHERE id=?`,
    )
    .run(round, reason, id)
}

export function liveSpots(): Spot[] {
  const rows = getDb()
    .prepare(`SELECT * FROM spots WHERE status = 'live' ORDER BY id ASC`)
    .all() as SpotRow[]
  return rows.map(toSpot)
}

export function spotByWallet(wallet: string): (Spot & { status: string }) | undefined {
  const r = getDb()
    .prepare(`SELECT * FROM spots WHERE wallet = ? AND status = 'live'`)
    .get(wallet) as SpotRow | undefined
  return r ? { ...toSpot(r), status: r.status } : undefined
}

export function getSpot(id: number): (Spot & { status: string }) | undefined {
  const r = getDb().prepare('SELECT * FROM spots WHERE id = ?').get(id) as SpotRow | undefined
  return r ? { ...toSpot(r), status: r.status } : undefined
}

export function sectorTaken(sector: number): boolean {
  const r = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM spots WHERE sector = ? AND status = 'live'`)
    .get(sector) as { n: number }
  return r.n > 0
}

export function bumpDepth(ids: number[]): void {
  if (ids.length === 0) return
  const marks = ids.map(() => '?').join(',')
  getDb().prepare(`UPDATE spots SET depth = depth + 1 WHERE id IN (${marks})`).run(...ids)
}

export function setSpotTokens(id: number, tokens: number): void {
  getDb().prepare('UPDATE spots SET tokens = ? WHERE id = ?').run(tokens, id)
}

export function occupiedSectors(): Set<number> {
  const rows = getDb()
    .prepare(`SELECT DISTINCT sector FROM spots WHERE status = 'live'`)
    .all() as { sector: number }[]
  return new Set(rows.map((r) => r.sector))
}

// --------------------------------------------------------------- payouts

export type PayoutRow = {
  id: number
  round_id: number
  wallet: string
  spot_id: number | null
  kind: string
  lamports: number
  status: string
  signature: string | null
  paid_at: number | null
}

export function recordPayout(p: {
  roundId: number
  wallet: string
  spotId: number | null
  kind: 'strike' | 'rift' | 'pool'
  lamports: number
}): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO payouts (round_id, wallet, spot_id, kind, lamports)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(p.roundId, p.wallet, p.spotId, p.kind, p.lamports)
}

export function owedByWallet(): { wallet: string; lamports: number; rounds: number }[] {
  return getDb()
    .prepare(
      `SELECT wallet, SUM(lamports) AS lamports, COUNT(DISTINCT round_id) AS rounds
       FROM payouts WHERE status = 'owed' AND lamports > 0
       GROUP BY wallet ORDER BY lamports DESC`,
    )
    .all() as { wallet: string; lamports: number; rounds: number }[]
}

export function walletPayouts(wallet: string, limit = 60): PayoutRow[] {
  return getDb()
    .prepare('SELECT * FROM payouts WHERE wallet = ? ORDER BY id DESC LIMIT ?')
    .all(wallet, limit) as PayoutRow[]
}

export function roundPayouts(roundId: number): PayoutRow[] {
  return getDb()
    .prepare('SELECT * FROM payouts WHERE round_id = ? ORDER BY lamports DESC')
    .all(roundId) as PayoutRow[]
}

/** Operator marks a wallet settled after paying by hand. */
export function markWalletPaid(wallet: string, signature: string): number {
  const res = getDb()
    .prepare(
      `UPDATE payouts SET status='paid', signature=?, paid_at=?
       WHERE wallet = ? AND status = 'owed'`,
    )
    .run(signature, Date.now(), wallet)
  return Number(res.changes)
}

export function totalOwed(): number {
  const r = getDb()
    .prepare(`SELECT COALESCE(SUM(lamports), 0) AS n FROM payouts WHERE status = 'owed'`)
    .get() as { n: number }
  return r.n
}

export function totalPaid(): number {
  const r = getDb()
    .prepare(`SELECT COALESCE(SUM(lamports), 0) AS n FROM payouts WHERE status = 'paid'`)
    .get() as { n: number }
  return r.n
}

// ---------------------------------------------------------------- nonces

export function issueNonce(wallet: string, nonce: string): void {
  getDb()
    .prepare('INSERT INTO nonces (nonce, wallet, created_at) VALUES (?, ?, ?)')
    .run(nonce, wallet, Date.now())
}

/** Single-use, wallet-bound, five minute lifetime. */
export function consumeNonce(wallet: string, nonce: string): boolean {
  const row = getDb().prepare('SELECT * FROM nonces WHERE nonce = ?').get(nonce) as
    | { wallet: string; created_at: number; used: number }
    | undefined

  if (!row || row.used === 1) return false
  if (row.wallet !== wallet) return false
  if (Date.now() - row.created_at > 5 * 60_000) return false

  getDb().prepare('UPDATE nonces SET used = 1 WHERE nonce = ?').run(nonce)
  return true
}
