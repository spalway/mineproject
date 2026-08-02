import { solUsd, tokenUsd, birdeyeConfigured } from '@/lib/birdeye'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Display-only. Returns null rather than a guess when Birdeye is unconfigured
 * or unreachable, so the UI can omit prices instead of showing a made-up one.
 */
export async function GET() {
  const [sol, token] = await Promise.all([solUsd(), tokenUsd()])
  return Response.json({ configured: birdeyeConfigured(), sol, token })
}
