import { recentEpochs, epochPayouts } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get('limit') ?? 30)
  const epochs = recentEpochs(Math.min(Math.max(limit, 1), 200))

  return Response.json({
    epochs: epochs.map((e) => ({ ...e, payouts: epochPayouts(e.id) })),
  })
}
