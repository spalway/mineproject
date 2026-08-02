import { getTokenMint } from '@/lib/chain'
import { birdeyeConfigured, solUsd, tokenOverview } from '@/lib/birdeye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Display-only token figures. Returns nulls rather than guesses when the mint
 * is unset or Birdeye is unconfigured, so the UI can omit a field instead of
 * showing a fabricated number.
 */
export async function GET() {
  const mint = await getTokenMint()
  const [stats, sol] = await Promise.all([tokenOverview(mint), solUsd()])

  return Response.json({
    mint,
    live: !!mint,
    pricesConfigured: birdeyeConfigured(),
    sol,
    stats,
  })
}
