import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Spot } from '../payout'
import type { CloseRoundInput, MintRow, PayoutRow, RoundRow, Store } from './types'

/**
 * Supabase-backed store.
 *
 * Uses the SERVICE ROLE key, which bypasses RLS. That is required: the schema
 * grants public read and no public write, so the anon/publishable key cannot
 * insert a round, a spot or a payout. The service key is server-only and must
 * never reach the browser — nothing in this file is imported by a client
 * component.
 */

export function supabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('supabase url or service role key is missing')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Throws with the Postgres message rather than a bare "false". */
function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

/**
 * True when PostgREST reports the function does not exist, which happens if
 * the project was provisioned before rpcs.sql was added. Every RPC below has
 * a plain-query fallback for exactly this case — a partially migrated schema
 * should run slower, not take the site down.
 */
function isMissingFunction(message: string): boolean {
  return /could not find the function/i.test(message)
}

let warnedMissingRpc = false
function warnOnce(fn: string) {
  if (warnedMissingRpc) return
  warnedMissingRpc = true
  console.warn(
    `[store] ${fn} is missing; using a slower fallback. Run supabase/rpcs.sql to restore it.`,
  )
}

const toSpot = (r: {
  id: number
  wallet: string
  sector: number
  depth: number
  tokens: number | string
}): Spot => ({
  id: Number(r.id),
  wallet: r.wallet,
  sector: Number(r.sector),
  depth: Number(r.depth),
  tokens: Number(r.tokens),
})

export function createSupabaseStore(): Store {
  const db = client()

  /** Sum the ledger client-side when nodei_totals is unavailable. */
  async function totalsFallback(): Promise<{ owed: number; paid: number }> {
    const { data, error } = await db.from('payouts').select('status, lamports')
    if (error) throw new Error(`totals fallback: ${error.message}`)

    let owed = 0
    let paid = 0
    for (const row of data ?? []) {
      if (row.status === 'owed') owed += Number(row.lamports)
      else if (row.status === 'paid') paid += Number(row.lamports)
    }
    return { owed, paid }
  }

  async function totals(): Promise<{ owed: number; paid: number }> {
    const { data, error } = await db.rpc('nodei_totals')
    if (error) {
      if (!isMissingFunction(error.message)) throw new Error(`totals: ${error.message}`)
      warnOnce('nodei_totals')
      return totalsFallback()
    }
    return {
      owed: Number(data?.[0]?.owed ?? 0),
      paid: Number(data?.[0]?.paid ?? 0),
    }
  }

  return {
    kind: 'supabase',

    async ready() {
      // Cheap round trip that also proves the service key is accepted.
      const { error } = await db.from('config').select('key').limit(1)
      if (error) throw new Error(`supabase not reachable: ${error.message}`)
    },

    // ------------------------------------------------------------- config

    async configGet(key) {
      const { data, error } = await db
        .from('config')
        .select('value')
        .eq('key', key)
        .maybeSingle()
      if (error) throw new Error(`configGet: ${error.message}`)
      const value = data?.value?.trim()
      return value ? value : null
    },

    async configSet(key, value) {
      must(
        await db
          .from('config')
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        'configSet',
      )
    },

    // --------------------------------------------------------------- meta

    async metaGet(key) {
      const { data } = await db.from('meta').select('value').eq('key', key).maybeSingle()
      return data?.value ?? null
    },
    async metaSet(key, value) {
      must(await db.from('meta').upsert({ key, value }, { onConflict: 'key' }), 'metaSet')
    },

    async getCarried() {
      const { data } = await db.from('meta').select('value').eq('key', 'carried').maybeSingle()
      return Number(data?.value ?? 0)
    },
    async setCarried(n) {
      must(
        await db.from('meta').upsert({ key: 'carried', value: String(n) }, { onConflict: 'key' }),
        'setCarried',
      )
    },
    async getLastTreasury() {
      const { data } = await db
        .from('meta')
        .select('value')
        .eq('key', 'last_treasury')
        .maybeSingle()
      return data?.value === undefined || data?.value === null ? null : Number(data.value)
    },
    async setLastTreasury(n) {
      must(
        await db
          .from('meta')
          .upsert({ key: 'last_treasury', value: String(n) }, { onConflict: 'key' }),
        'setLastTreasury',
      )
    },

    // ------------------------------------------------------------- rounds

    async openRound(startedAt) {
      const { data, error } = await db
        .from('rounds')
        .insert({ started_at: startedAt })
        .select('id')
        .single()
      if (error || !data) {
        throw new Error(`openRound: ${error?.message ?? 'no row returned'}`)
      }
      return Number(data.id)
    },

    async currentRound() {
      const { data, error } = await db
        .from('rounds')
        .select('*')
        .eq('status', 'open')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(`currentRound: ${error.message}`)
      return (data as RoundRow) ?? undefined
    },

    async getRound(id) {
      const { data } = await db.from('rounds').select('*').eq('id', id).maybeSingle()
      return (data as RoundRow) ?? undefined
    },

    async closeRound(id, f: CloseRoundInput) {
      must(
        await db
          .from('rounds')
          .update({
            ended_at: f.endedAt,
            status: f.status,
            strike_sector: f.strikeSector,
            pot_lamports: f.pot,
            carried_lamports: f.carried,
            fee_accrued_lamports: f.feeAccrued,
            treasury_lamports: f.treasury,
            migration_mint: f.migrationMint,
            mint_count: f.mintCount,
            uptime_ratio: f.uptimeRatio,
          })
          .eq('id', id),
        'closeRound',
      )
    },

    async resetRoundStart(id, startedAt) {
      must(
        await db.from('rounds').update({ started_at: startedAt }).eq('id', id),
        'resetRoundStart',
      )
    },

    async recentRounds(limit = 30) {
      const { data } = await db
        .from('rounds')
        .select('*')
        .neq('status', 'open')
        .order('id', { ascending: false })
        .limit(limit)
      return (data ?? []) as RoundRow[]
    },

    // --------------------------------------------------------------- feed

    async insertMint(m) {
      // Duplicate mints are expected on reconnect; ignore rather than throw.
      must(
        await db.from('mints').upsert(
          {
            mint: m.mint,
            sector: m.sector,
            round_id: m.roundId,
            received_at: m.receivedAt,
            name: m.name ?? null,
            symbol: m.symbol ?? null,
            uri: m.uri ?? null,
            creator: m.creator ?? null,
          },
          { onConflict: 'mint', ignoreDuplicates: true },
        ),
        'insertMint',
      )
    },

    async insertMigration(g) {
      must(
        await db.from('migrations').upsert(
          {
            mint: g.mint,
            sector: g.sector,
            round_id: g.roundId,
            received_at: g.receivedAt,
          },
          { onConflict: 'mint', ignoreDuplicates: true },
        ),
        'insertMigration',
      )
    },

    async roundMints(roundId) {
      const { data } = await db
        .from('mints')
        .select('*')
        .eq('round_id', roundId)
        .order('received_at', { ascending: true })
      return (data ?? []) as MintRow[]
    },

    async roundMigrations(roundId) {
      const { data } = await db.from('migrations').select('mint, sector').eq('round_id', roundId)
      return (data ?? []) as { mint: string; sector: number }[]
    },

    async markUncounted(mints) {
      if (mints.length === 0) return
      must(await db.from('mints').update({ counted: false }).in('mint', mints), 'markUncounted')
    },

    async recentMints(limit = 50) {
      const { data } = await db
        .from('mints')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(limit)
      return (data ?? []) as MintRow[]
    },

    async recentMigrations(limit = 20) {
      const { data } = await db
        .from('migrations')
        .select('mint, sector, received_at')
        .order('received_at', { ascending: false })
        .limit(limit)
      return (data ?? []) as { mint: string; sector: number; received_at: number }[]
    },

    // -------------------------------------------------------------- spots

    async claimSpot(s) {
      // Goes through an RPC so the insert is one statement; the partial unique
      // indexes reject a double claim and the error surfaces to the route.
      const { data, error } = await db.rpc('nodei_claim_spot', {
        p_wallet: s.wallet,
        p_sector: s.sector,
        p_tokens: s.tokens,
        p_round: s.round,
      })
      if (!error) return Number(data)
      if (!isMissingFunction(error.message)) throw new Error(`claimSpot: ${error.message}`)
      warnOnce('nodei_claim_spot')

      // Plain insert. Still safe: the partial unique indexes are what actually
      // prevent a double claim, and a loser gets a constraint error either way.
      const { data: row, error: insertErr } = await db
        .from('spots')
        .insert({
          wallet: s.wallet,
          sector: s.sector,
          tokens: s.tokens,
          claimed_round: s.round,
        })
        .select('id')
        .single()
      if (insertErr || !row) {
        throw new Error(`claimSpot: ${insertErr?.message ?? 'no row returned'}`)
      }
      return Number(row.id)
    },

    async releaseSpot(id, round, reason) {
      must(
        await db
          .from('spots')
          .update({ status: 'released', released_round: round, released_reason: reason })
          .eq('id', id),
        'releaseSpot',
      )
    },

    async liveSpots() {
      const { data } = await db
        .from('spots')
        .select('id, wallet, sector, depth, tokens')
        .eq('status', 'live')
        .order('id', { ascending: true })
      return (data ?? []).map(toSpot)
    },

    async spotByWallet(wallet) {
      const { data } = await db
        .from('spots')
        .select('id, wallet, sector, depth, tokens, status')
        .eq('wallet', wallet)
        .eq('status', 'live')
        .maybeSingle()
      return data ? { ...toSpot(data), status: data.status } : undefined
    },

    async getSpot(id) {
      const { data } = await db
        .from('spots')
        .select('id, wallet, sector, depth, tokens, status')
        .eq('id', id)
        .maybeSingle()
      return data ? { ...toSpot(data), status: data.status } : undefined
    },

    async sectorTaken(sector) {
      const { count } = await db
        .from('spots')
        .select('id', { count: 'exact', head: true })
        .eq('sector', sector)
        .eq('status', 'live')
      return (count ?? 0) > 0
    },

    async bumpDepth(ids) {
      if (ids.length === 0) return

      const { error } = await db.rpc('nodei_bump_depth', { p_ids: ids })
      if (!error) return
      if (!isMissingFunction(error.message)) throw new Error(`bumpDepth: ${error.message}`)
      warnOnce('nodei_bump_depth')

      // Read the current depths and write them back incremented. PostgREST
      // cannot express `depth = depth + 1`, and an upsert would violate the
      // NOT NULL columns it does not carry, so this is one update per spot.
      const { data, error: readErr } = await db
        .from('spots')
        .select('id, depth')
        .in('id', ids)
      if (readErr) throw new Error(`bumpDepth read: ${readErr.message}`)

      await Promise.all(
        (data ?? []).map((row) =>
          db
            .from('spots')
            .update({ depth: Number(row.depth) + 1 })
            .eq('id', row.id),
        ),
      )
    },

    async setSpotTokens(id, tokens) {
      must(await db.from('spots').update({ tokens }).eq('id', id), 'setSpotTokens')
    },

    async occupiedSectors() {
      const { data } = await db.from('spots').select('sector').eq('status', 'live')
      return new Set((data ?? []).map((r) => Number(r.sector)))
    },

    async spotsDuringRound(roundId) {
      const { data } = await db
        .from('spots')
        .select('id, wallet, sector, released_round')
        .lte('claimed_round', roundId)
        .or(`released_round.is.null,released_round.gt.${roundId}`)
        .order('sector', { ascending: true })
      return (data ?? []).map((r) => ({
        id: Number(r.id),
        wallet: r.wallet,
        sector: Number(r.sector),
      }))
    },

    // ------------------------------------------------------------ payouts

    async recordPayout(p) {
      must(
        await db.from('payouts').upsert(
          {
            round_id: p.roundId,
            wallet: p.wallet,
            spot_id: p.spotId,
            kind: p.kind,
            lamports: p.lamports,
          },
          { onConflict: 'round_id,spot_id,kind', ignoreDuplicates: true },
        ),
        'recordPayout',
      )
    },

    async owedByWallet() {
      const { data } = await db
        .from('v_owed_by_wallet')
        .select('wallet, lamports, rounds')
        .order('lamports', { ascending: false })
      return (data ?? []).map((r) => ({
        wallet: r.wallet,
        lamports: Number(r.lamports),
        rounds: Number(r.rounds),
      }))
    },

    async walletPayouts(wallet, limit = 60) {
      const { data } = await db
        .from('payouts')
        .select('*')
        .eq('wallet', wallet)
        .order('id', { ascending: false })
        .limit(limit)
      return (data ?? []) as PayoutRow[]
    },

    async roundPayouts(roundId) {
      const { data } = await db
        .from('payouts')
        .select('*')
        .eq('round_id', roundId)
        .order('lamports', { ascending: false })
      return (data ?? []) as PayoutRow[]
    },

    async totalOwed() {
      return (await totals()).owed
    },

    async totalPaid() {
      return (await totals()).paid
    },

    // ------------------------------------------------------------- nonces

    async issueNonce(wallet, nonce) {
      must(await db.from('nonces').insert({ nonce, wallet }), 'issueNonce')
    },

    async consumeNonce(wallet, nonce) {
      const { data } = await db
        .from('nonces')
        .select('wallet, created_at, used')
        .eq('nonce', nonce)
        .maybeSingle()

      if (!data || data.used) return false
      if (data.wallet !== wallet) return false
      if (Date.now() - new Date(data.created_at).getTime() > 5 * 60_000) return false

      // Only flips a row that is still unused, so two racing requests cannot
      // both consume the same nonce.
      const { data: claimed } = await db
        .from('nonces')
        .update({ used: true })
        .eq('nonce', nonce)
        .eq('used', false)
        .select('nonce')
      return (claimed?.length ?? 0) > 0
    },
  }
}
