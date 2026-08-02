import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Rig } from './payout'

/**
 * Storage uses Node's first-party `node:sqlite`. Same synchronous shape as
 * better-sqlite3 but with no native compile step, which matters on Windows
 * where npm blocks install scripts by default.
 *
 * All money columns are INTEGER lamports. Never store money as REAL.
 */

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS epochs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at        INTEGER NOT NULL,
  ended_at          INTEGER,
  status            TEXT    NOT NULL DEFAULT 'open',
  strike_sector     INTEGER,
  pot_lamports      INTEGER NOT NULL DEFAULT 0,
  treasury_lamports INTEGER NOT NULL DEFAULT 0,
  vein_add_lamports INTEGER NOT NULL DEFAULT 0,
  vein_paid_lamports INTEGER NOT NULL DEFAULT 0,
  migration_mint    TEXT,
  mint_count        INTEGER NOT NULL DEFAULT 0,
  uptime_ratio      REAL    NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mints (
  mint        TEXT PRIMARY KEY,
  sector      INTEGER NOT NULL,
  epoch_id    INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  name        TEXT,
  symbol      TEXT,
  uri         TEXT,
  creator     TEXT,
  counted     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_mints_epoch ON mints(epoch_id);

CREATE TABLE IF NOT EXISTS migrations (
  mint        TEXT PRIMARY KEY,
  sector      INTEGER NOT NULL,
  epoch_id    INTEGER NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_migrations_epoch ON migrations(epoch_id);

CREATE TABLE IF NOT EXISTS rigs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet          TEXT    NOT NULL,
  sector          INTEGER NOT NULL,
  balance_lamports INTEGER NOT NULL,
  depth           INTEGER NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'active',
  deploy_sig      TEXT    NOT NULL UNIQUE,
  created_epoch   INTEGER NOT NULL,
  closed_epoch    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rigs_status ON rigs(status);
CREATE INDEX IF NOT EXISTS idx_rigs_wallet ON rigs(wallet);

CREATE TABLE IF NOT EXISTS draws (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  rig_id   INTEGER NOT NULL,
  epoch_id INTEGER NOT NULL,
  lamports INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  epoch_id  INTEGER NOT NULL,
  wallet    TEXT    NOT NULL,
  rig_id    INTEGER,
  kind      TEXT    NOT NULL,
  lamports  INTEGER NOT NULL,
  signature TEXT,
  status    TEXT    NOT NULL DEFAULT 'pending',
  UNIQUE (epoch_id, rig_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

CREATE TABLE IF NOT EXISTS vein (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  balance_lamports INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO vein (id, balance_lamports) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS used_sigs (
  signature TEXT PRIMARY KEY,
  seen_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS nonces (
  nonce      TEXT PRIMARY KEY,
  wallet     TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);
`

let handle: DatabaseSync | null = null

export function getDb(path?: string, opts?: { reset?: boolean }): DatabaseSync {
  if (handle && !opts?.reset) return handle
  if (handle && opts?.reset) {
    handle.close()
    handle = null
  }

  const target = path ?? process.env.PUMPJACK_DB ?? '.data/pumpjack.db'
  if (target !== ':memory:') mkdirSync(dirname(target), { recursive: true })

  handle = new DatabaseSync(target)
  handle.exec(SCHEMA)
  return handle
}

// ---------------------------------------------------------------- epochs

export type EpochRow = {
  id: number
  started_at: number
  ended_at: number | null
  status: string
  strike_sector: number | null
  pot_lamports: number
  treasury_lamports: number
  vein_add_lamports: number
  vein_paid_lamports: number
  migration_mint: string | null
  mint_count: number
  uptime_ratio: number
}

export function openEpoch(startedAt: number): number {
  const r = getDb().prepare('INSERT INTO epochs (started_at) VALUES (?)').run(startedAt)
  return Number(r.lastInsertRowid)
}

export function currentEpoch(): EpochRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM epochs WHERE status = 'open' ORDER BY id DESC LIMIT 1`)
    .get() as EpochRow | undefined
}

export function closeEpoch(
  id: number,
  f: {
    endedAt: number
    status: 'resolved' | 'void'
    strikeSector: number | null
    pot: number
    treasury: number
    veinAdd: number
    veinPaid: number
    migrationMint: string | null
    mintCount: number
    uptimeRatio: number
  },
): void {
  getDb()
    .prepare(
      `UPDATE epochs SET ended_at=?, status=?, strike_sector=?, pot_lamports=?,
       treasury_lamports=?, vein_add_lamports=?, vein_paid_lamports=?,
       migration_mint=?, mint_count=?, uptime_ratio=? WHERE id=?`,
    )
    .run(
      f.endedAt,
      f.status,
      f.strikeSector,
      f.pot,
      f.treasury,
      f.veinAdd,
      f.veinPaid,
      f.migrationMint,
      f.mintCount,
      f.uptimeRatio,
      id,
    )
}

export function recentEpochs(limit = 50): EpochRow[] {
  return getDb()
    .prepare(`SELECT * FROM epochs WHERE status != 'open' ORDER BY id DESC LIMIT ?`)
    .all(limit) as EpochRow[]
}

// ----------------------------------------------------------------- feed

export type MintRow = {
  mint: string
  sector: number
  epoch_id: number
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
  epochId: number
  receivedAt: number
  name?: string | null
  symbol?: string | null
  uri?: string | null
  creator?: string | null
}): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO mints (mint, sector, epoch_id, received_at, name, symbol, uri, creator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      m.mint,
      m.sector,
      m.epochId,
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
  epochId: number
  receivedAt: number
}): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO migrations (mint, sector, epoch_id, received_at) VALUES (?, ?, ?, ?)`,
    )
    .run(g.mint, g.sector, g.epochId, g.receivedAt)
}

export function epochMints(epochId: number): MintRow[] {
  return getDb()
    .prepare('SELECT * FROM mints WHERE epoch_id = ? ORDER BY received_at ASC')
    .all(epochId) as MintRow[]
}

export function epochMigrations(epochId: number): { mint: string; sector: number }[] {
  return getDb()
    .prepare('SELECT mint, sector FROM migrations WHERE epoch_id = ?')
    .all(epochId) as { mint: string; sector: number }[]
}

/**
 * Flag mints that did not contribute to grade (per-creator cap, spec §3.7).
 * Stored rather than recomputed so the cap is auditable instead of invisible.
 */
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

export function recentMigrations(limit = 20): { mint: string; sector: number; received_at: number }[] {
  return getDb()
    .prepare('SELECT mint, sector, received_at FROM migrations ORDER BY received_at DESC LIMIT ?')
    .all(limit) as { mint: string; sector: number; received_at: number }[]
}

// ------------------------------------------------------------------ rigs

type RigRow = {
  id: number
  wallet: string
  sector: number
  balance_lamports: number
  depth: number
  status: string
  deploy_sig: string
  created_epoch: number
  closed_epoch: number | null
}

const toRig = (r: RigRow): Rig => ({
  id: r.id,
  wallet: r.wallet,
  sector: r.sector,
  balance: r.balance_lamports,
  depth: r.depth,
})

export function createRig(r: {
  wallet: string
  sector: number
  lamports: number
  sig: string
  epoch: number
}): number {
  const res = getDb()
    .prepare(
      `INSERT INTO rigs (wallet, sector, balance_lamports, deploy_sig, created_epoch)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(r.wallet, r.sector, r.lamports, r.sig, r.epoch)
  return Number(res.lastInsertRowid)
}

export function activeRigs(): Rig[] {
  const rows = getDb()
    .prepare(`SELECT * FROM rigs WHERE status = 'active' AND balance_lamports > 0`)
    .all() as RigRow[]
  return rows.map(toRig)
}

export function rigsInSectors(sectors: number[]): Rig[] {
  if (sectors.length === 0) return []
  const marks = sectors.map(() => '?').join(',')
  const rows = getDb()
    .prepare(
      `SELECT * FROM rigs WHERE status='active' AND balance_lamports > 0 AND sector IN (${marks})`,
    )
    .all(...sectors) as RigRow[]
  return rows.map(toRig)
}

export function walletRigs(wallet: string): (Rig & { status: string; deploySig: string })[] {
  const rows = getDb()
    .prepare('SELECT * FROM rigs WHERE wallet = ? ORDER BY id DESC')
    .all(wallet) as RigRow[]
  return rows.map((r) => ({ ...toRig(r), status: r.status, deploySig: r.deploy_sig }))
}

export function getRig(id: number): (Rig & { status: string }) | undefined {
  const r = getDb().prepare('SELECT * FROM rigs WHERE id = ?').get(id) as RigRow | undefined
  return r ? { ...toRig(r), status: r.status } : undefined
}

export function setRigBalance(id: number, lamports: number): void {
  getDb().prepare('UPDATE rigs SET balance_lamports = ? WHERE id = ?').run(lamports, id)
}

export function bumpDepth(ids: number[]): void {
  if (ids.length === 0) return
  const marks = ids.map(() => '?').join(',')
  getDb().prepare(`UPDATE rigs SET depth = depth + 1 WHERE id IN (${marks})`).run(...ids)
}

export function closeRig(id: number, epoch: number): void {
  getDb()
    .prepare(`UPDATE rigs SET status='closed', closed_epoch=?, balance_lamports=0 WHERE id=?`)
    .run(epoch, id)
}

export function occupiedSectors(): Set<number> {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT sector FROM rigs WHERE status='active' AND balance_lamports > 0`,
    )
    .all() as { sector: number }[]
  return new Set(rows.map((r) => r.sector))
}

// --------------------------------------------------------------- money

export function recordDraw(rigId: number, epochId: number, lamports: number): void {
  getDb()
    .prepare('INSERT INTO draws (rig_id, epoch_id, lamports) VALUES (?, ?, ?)')
    .run(rigId, epochId, lamports)
}

export type PayoutRow = {
  id: number
  epoch_id: number
  wallet: string
  rig_id: number | null
  kind: string
  lamports: number
  signature: string | null
  status: string
}

export function recordPayout(p: {
  epochId: number
  wallet: string
  rigId: number | null
  kind: 'strike' | 'rift' | 'vein' | 'withdraw'
  lamports: number
}): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO payouts (epoch_id, wallet, rig_id, kind, lamports)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(p.epochId, p.wallet, p.rigId, p.kind, p.lamports)
}

export function pendingPayouts(limit = 50): PayoutRow[] {
  return getDb()
    .prepare(`SELECT * FROM payouts WHERE status='pending' AND lamports > 0 ORDER BY id ASC LIMIT ?`)
    .all(limit) as PayoutRow[]
}

export function markPayoutSent(ids: number[], signature: string): void {
  if (ids.length === 0) return
  const marks = ids.map(() => '?').join(',')
  getDb()
    .prepare(`UPDATE payouts SET status='sent', signature=? WHERE id IN (${marks})`)
    .run(signature, ...ids)
}

export function markPayoutFailed(ids: number[]): void {
  if (ids.length === 0) return
  const marks = ids.map(() => '?').join(',')
  getDb().prepare(`UPDATE payouts SET status='pending' WHERE id IN (${marks})`).run(...ids)
}

export function epochPayouts(epochId: number): PayoutRow[] {
  return getDb()
    .prepare('SELECT * FROM payouts WHERE epoch_id = ? ORDER BY lamports DESC')
    .all(epochId) as PayoutRow[]
}

export function veinBalance(): number {
  const r = getDb().prepare('SELECT balance_lamports FROM vein WHERE id = 1').get() as
    | { balance_lamports: number }
    | undefined
  return r?.balance_lamports ?? 0
}

export function addToVein(lamports: number): void {
  getDb()
    .prepare('UPDATE vein SET balance_lamports = balance_lamports + ? WHERE id = 1')
    .run(lamports)
}

export function resetVein(): void {
  getDb().prepare('UPDATE vein SET balance_lamports = 0 WHERE id = 1').run()
}

// ------------------------------------------------------------ integrity

/** Returns false if this signature was already used. Replay protection. */
export function consumeSignature(signature: string): boolean {
  try {
    getDb()
      .prepare('INSERT INTO used_sigs (signature, seen_at) VALUES (?, ?)')
      .run(signature, Date.now())
    return true
  } catch {
    return false
  }
}

export function issueNonce(wallet: string, nonce: string): void {
  getDb()
    .prepare('INSERT INTO nonces (nonce, wallet, created_at) VALUES (?, ?, ?)')
    .run(nonce, wallet, Date.now())
}

/** Single-use, wallet-bound, 5 minute lifetime. */
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
