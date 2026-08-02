/**
 * Birdeye is used for one thing only: pricing SOL (and optionally the token)
 * in USD for display. Nothing in the mechanic depends on it — if the key is
 * missing or the call fails, prices are simply omitted rather than guessed.
 */

const BIRDEYE = 'https://public-api.birdeye.so'
const SOL_MINT = 'So11111111111111111111111111111111111111112'

const CACHE_MS = 60_000

type Cached = { value: number; at: number }
const cache = new Map<string, Cached>()

async function price(mint: string): Promise<number | null> {
  const key = process.env.BIRDEYE_API_KEY
  if (!key) return null

  const hit = cache.get(mint)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value

  try {
    const res = await fetch(`${BIRDEYE}/defi/price?address=${mint}`, {
      headers: { 'X-API-KEY': key, accept: 'application/json', 'x-chain': 'solana' },
      cache: 'no-store',
    })
    if (!res.ok) return hit?.value ?? null

    const body = (await res.json()) as { data?: { value?: number } }
    const value = body.data?.value
    if (typeof value !== 'number' || !Number.isFinite(value)) return hit?.value ?? null

    cache.set(mint, { value, at: Date.now() })
    return value
  } catch {
    // Stale is better than wrong, and null is better than invented.
    return hit?.value ?? null
  }
}

export const solUsd = () => price(SOL_MINT)

export const tokenUsd = (mint: string) => (mint ? price(mint) : Promise.resolve(null))

export const birdeyeConfigured = () => !!process.env.BIRDEYE_API_KEY

export type TokenStats = {
  price: number | null
  mcap: number | null
  liquidity: number | null
  volume24h: number | null
  holders: number | null
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/**
 * Headline token figures for display. Every field is independently nullable —
 * a missing figure renders as a dash rather than a zero, because zero market
 * cap and unknown market cap are very different claims.
 */
export async function tokenOverview(mint: string): Promise<TokenStats | null> {
  const key = process.env.BIRDEYE_API_KEY
  if (!key || !mint) return null

  try {
    const res = await fetch(`${BIRDEYE}/defi/token_overview?address=${mint}`, {
      headers: { 'X-API-KEY': key, accept: 'application/json', 'x-chain': 'solana' },
      cache: 'no-store',
    })
    if (!res.ok) return null

    const body = (await res.json()) as { data?: Record<string, unknown> }
    const d = body.data
    if (!d) return null

    return {
      price: num(d.price),
      mcap: num(d.marketCap) ?? num(d.mc),
      liquidity: num(d.liquidity),
      volume24h: num(d.v24hUSD),
      holders: num(d.holder),
    }
  } catch {
    return null
  }
}
