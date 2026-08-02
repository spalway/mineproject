import { recentRounds, roundPayouts } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get('limit') ?? 30)
  const rounds = recentRounds(Math.min(Math.max(limit, 1), 200))

  return Response.json({
    rounds: rounds.map((r) => ({ ...r, payouts: roundPayouts(r.id) })),
  })
}
