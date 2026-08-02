import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Diagnostic probe. Never throws — every check is caught and reported
 * individually, so a broken store shows you WHICH call fails instead of
 * collapsing into one opaque 500.
 */
async function probe<T>(name: string, fn: () => Promise<T>) {
  const started = Date.now()
  try {
    const value = await fn()
    return {
      check: name,
      ok: true as const,
      ms: Date.now() - started,
      sample: summarise(value),
    }
  } catch (err) {
    return {
      check: name,
      ok: false as const,
      ms: Date.now() - started,
      error: (err as Error).message,
    }
  }
}

function summarise(v: unknown): unknown {
  if (v === null || v === undefined) return v
  if (Array.isArray(v)) return `${v.length} rows`
  if (v instanceof Set) return `${v.size} entries`
  if (typeof v === 'object') return Object.keys(v as object).slice(0, 6)
  return v
}

export async function GET() {
  const store = getStore()

  const env = {
    storage: store.kind,
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    publishableKeyOnly:
      !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
    rpcUrl: !!process.env.RPC_URL,
    treasury: !!process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
    tokenMintEnv: !!process.env.NEXT_PUBLIC_TOKEN_MINT,
    birdeye: !!process.env.BIRDEYE_API_KEY,
  }

  // Ordered roughly by dependency, so the first failure is the useful one.
  const checks = [
    await probe('store.ready (connectivity + key accepted)', () => store.ready()),
    await probe('config table', () => store.configGet('token_mint')),
    await probe('meta table', () => store.getCarried()),
    await probe('rounds table', () => store.currentRound()),
    await probe('mints table', () => store.recentMints(1)),
    await probe('migrations table', () => store.recentMigrations(1)),
    await probe('spots table', () => store.liveSpots()),
    await probe('payouts table', () => store.roundPayouts(1)),
    await probe('view v_owed_by_wallet', () => store.owedByWallet()),
    await probe('rpc nodei_totals', () => store.totalOwed()),
    // Non-existent id: updates nothing, but proves the function exists.
    // An empty array would short-circuit before reaching the RPC.
    await probe('rpc nodei_bump_depth', () => store.bumpDepth([-1])),
  ]

  const failed = checks.filter((c) => !c.ok)

  return Response.json(
    {
      ok: failed.length === 0,
      env,
      failedCount: failed.length,
      firstFailure: failed[0] ?? null,
      checks,
    },
    { status: failed.length === 0 ? 200 : 503 },
  )
}
