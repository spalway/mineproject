import { sectorOf, coordsOf } from '@/lib/sector'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Public trust endpoint. Anyone can check that a token's sector really is
 * derived from its own address and nothing else — the claim the whole protocol
 * rests on.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params

  try {
    const sector = sectorOf(mint)
    const { row, col } = coordsOf(sector)
    return Response.json({
      mint,
      sector,
      row,
      col,
      derivation: `pubkey[0] % ${CONFIG.SECTOR_COUNT}`,
    })
  } catch {
    return Response.json({ error: 'not a valid base58 public key' }, { status: 400 })
  }
}
