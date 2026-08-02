import * as sql from '../db'
import type { CloseRoundInput, Store } from './types'

/**
 * SQLite-backed store.
 *
 * A thin async facade over the synchronous implementation in db.ts, which is
 * the one the mechanic tests exercise. Keeping it means the payout, round and
 * spot logic stays testable with no network and no Postgres.
 */
export function createSqliteStore(path?: string): Store {
  return {
    kind: 'sqlite',
    async ready() {
      sql.getDb(path)
    },

    async configGet(key) {
      return sql.configGet(key)
    },
    async configSet(key, value) {
      sql.configSet(key, value)
    },

    async metaGet(key) {
      return sql.metaGet(key)
    },
    async metaSet(key, value) {
      sql.metaSet(key, value)
    },

    async getCarried() {
      return sql.getCarried()
    },
    async setCarried(n) {
      sql.setCarried(n)
    },
    async getLastTreasury() {
      return sql.getLastTreasury()
    },
    async setLastTreasury(n) {
      sql.setLastTreasury(n)
    },

    async openRound(startedAt) {
      return sql.openRound(startedAt)
    },
    async currentRound() {
      return sql.currentRound()
    },
    async getRound(id) {
      return sql.getRound(id)
    },
    async closeRound(id, f: CloseRoundInput) {
      sql.closeRound(id, f)
    },
    async resetRoundStart(id, startedAt) {
      sql.resetRoundStart(id, startedAt)
    },
    async recentRounds(limit) {
      return sql.recentRounds(limit)
    },

    async insertMint(m) {
      sql.insertMint(m)
    },
    async insertMigration(g) {
      sql.insertMigration(g)
    },
    async roundMints(roundId) {
      return sql.roundMints(roundId)
    },
    async roundMigrations(roundId) {
      return sql.roundMigrations(roundId)
    },
    async markUncounted(mints) {
      sql.markUncounted(mints)
    },
    async recentMints(limit) {
      return sql.recentMints(limit)
    },
    async recentMigrations(limit) {
      return sql.recentMigrations(limit)
    },

    async claimSpot(s) {
      return sql.claimSpot(s)
    },
    async releaseSpot(id, round, reason) {
      sql.releaseSpot(id, round, reason)
    },
    async liveSpots() {
      return sql.liveSpots()
    },
    async spotByWallet(wallet) {
      return sql.spotByWallet(wallet)
    },
    async getSpot(id) {
      return sql.getSpot(id)
    },
    async sectorTaken(sector) {
      return sql.sectorTaken(sector)
    },
    async bumpDepth(ids) {
      sql.bumpDepth(ids)
    },
    async setSpotTokens(id, tokens) {
      sql.setSpotTokens(id, tokens)
    },
    async occupiedSectors() {
      return sql.occupiedSectors()
    },
    async spotsDuringRound(roundId) {
      return sql.spotsDuringRound(roundId)
    },

    async recordPayout(p) {
      sql.recordPayout(p)
    },
    async owedByWallet() {
      return sql.owedByWallet()
    },
    async walletPayouts(wallet, limit) {
      return sql.walletPayouts(wallet, limit)
    },
    async roundPayouts(roundId) {
      return sql.roundPayouts(roundId)
    },
    async totalOwed() {
      return sql.totalOwed()
    },
    async totalPaid() {
      return sql.totalPaid()
    },

    async issueNonce(wallet, nonce) {
      sql.issueNonce(wallet, nonce)
    },
    async consumeNonce(wallet, nonce) {
      return sql.consumeNonce(wallet, nonce)
    },
  }
}
