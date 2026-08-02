import { getDb } from '../db'
import { createSqliteStore } from './sqlite'
import { createSupabaseStore, supabaseConfigured } from './supabase'
import type { Store } from './types'

export type { Store, RoundRow, MintRow, PayoutRow } from './types'

/**
 * Picks the backing store once per process.
 *
 * Supabase when it is configured, SQLite otherwise. The fallback is what lets
 * the app boot and the tests run without a database, and the choice is logged
 * so it is never a mystery which one production is talking to.
 *
 * Resolved through a function rather than a module const so tests can swap in
 * a fresh in-memory store between cases.
 */
const globalRef = globalThis as unknown as { __nodeiStore?: Store }

export function getStore(): Store {
  if (!globalRef.__nodeiStore) {
    globalRef.__nodeiStore = supabaseConfigured()
      ? (console.log('[store] supabase'), createSupabaseStore())
      : (console.log('[store] sqlite'), createSqliteStore())
  }
  return globalRef.__nodeiStore
}

/** Test helper: swap in a fresh, empty in-memory SQLite store. */
export function useMemoryStore(): Store {
  getDb(':memory:', { reset: true })
  const s = createSqliteStore(':memory:')
  globalRef.__nodeiStore = s
  return s
}
