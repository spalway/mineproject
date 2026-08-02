import { spotByWallet, walletPayouts } from '@/lib/db'
import { weightOf } from '@/lib/payout'
import { tokenBalance, isValidPubkey } from '@/lib/chain'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ pubkey: string }> }) {
  const { pubkey } = await ctx.params

  if (!isValidPubkey(pubkey)) {
    return Response.json({ error: 'not a valid wallet address' }, { status: 400 })
  }

  const spot = spotByWallet(pubkey)
  const payouts = walletPayouts(pubkey)
  const tokens = await tokenBalance(pubkey)

  const owed = payouts
    .filter((p) => p.status === 'owed')
    .reduce((sum, p) => sum + p.lamports, 0)
  const paid = payouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.lamports, 0)

  return Response.json({
    wallet: pubkey,
    tokens,
    eligible: tokens >= CONFIG.MIN_TOKEN_BALANCE,
    required: CONFIG.MIN_TOKEN_BALANCE,
    spot: spot ? { ...spot, weight: weightOf(spot) } : null,
    owed,
    paid,
    payouts,
  })
}
