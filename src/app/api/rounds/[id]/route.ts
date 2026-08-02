import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Everything needed to reconstruct one round: the board as it stood, and what
 * each wallet was allocated, ranked by share of the pot.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const store = getStore()
  const { id } = await ctx.params
  const roundId = Number(id)

  if (!Number.isInteger(roundId) || roundId < 1) {
    return Response.json({ error: 'bad round id' }, { status: 400 })
  }

  const round = await store.getRound(roundId)
  if (!round) return Response.json({ error: 'no such round' }, { status: 404 })

  const [board, payouts] = await Promise.all([
    store.spotsDuringRound(roundId),
    store.roundPayouts(roundId),
  ])
  const sectorBySpot = new Map(board.map((s) => [s.id, s.sector]))

  const grouped = new Map<
    string,
    { wallet: string; sector: number | null; lamports: number; legs: Record<string, number> }
  >()

  for (const p of payouts) {
    const entry = grouped.get(p.wallet) ?? {
      wallet: p.wallet,
      sector: p.spot_id === null ? null : (sectorBySpot.get(p.spot_id) ?? null),
      lamports: 0,
      legs: {},
    }
    entry.lamports += p.lamports
    entry.legs[p.kind] = (entry.legs[p.kind] ?? 0) + p.lamports
    grouped.set(p.wallet, entry)
  }

  const distributed = [...grouped.values()].reduce((sum, w) => sum + w.lamports, 0)

  const wallets = [...grouped.values()]
    .sort((a, b) => b.lamports - a.lamports)
    .map((w, i) => ({
      ...w,
      rank: i + 1,
      // Share of what actually went out this round, not of the headline pot —
      // the carried remainder never reached anyone.
      share: distributed > 0 ? w.lamports / distributed : 0,
    }))

  return Response.json({ round, board, wallets, distributed })
}
