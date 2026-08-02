import { walletRigs, getDb } from '@/lib/db'
import { weightOf } from '@/lib/payout'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ pubkey: string }> }) {
  const { pubkey } = await ctx.params

  const rigs = walletRigs(pubkey).map((r) => ({
    ...r,
    weight: weightOf(r),
    drawPerEpoch: Math.floor((r.balance * CONFIG.DRAW_BPS) / 10_000),
  }))

  const payouts = getDb()
    .prepare(
      `SELECT id, epoch_id, kind, lamports, signature, status
       FROM payouts WHERE wallet = ? ORDER BY id DESC LIMIT 50`,
    )
    .all(pubkey)

  return Response.json({ wallet: pubkey, rigs, payouts })
}
