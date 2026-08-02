import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const store = getStore()
  const limit = Number(new URL(req.url).searchParams.get('limit') ?? 30)
  const rounds = await store.recentRounds(Math.min(Math.max(limit, 1), 200))

  const withPayouts = await Promise.all(
    rounds.map(async (r) => ({ ...r, payouts: await store.roundPayouts(r.id) })),
  )

  return Response.json({ rounds: withPayouts })
}
