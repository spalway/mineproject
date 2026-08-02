import { releaseMessage } from '@/lib/messages'
import { verifySignedMessage } from '@/lib/chain'
import { consumeNonce, currentRound, getSpot, releaseSpot } from '@/lib/db'
import { bus } from '@/lib/bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Giving up a spot. Also signature-only. Anything already owed stays owed —
 * releasing forfeits depth, not earnings.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'malformed request body' }, { status: 400 })
  }

  const wallet = typeof body.wallet === 'string' ? body.wallet : null
  const nonce = typeof body.nonce === 'string' ? body.nonce : null
  const signature = typeof body.signature === 'string' ? body.signature : null
  const spotId = typeof body.spotId === 'number' ? body.spotId : null

  if (!wallet || !nonce || !signature || spotId === null) {
    return Response.json(
      { error: 'wallet, spotId, nonce and signature are required' },
      { status: 400 },
    )
  }

  if (!verifySignedMessage(wallet, releaseMessage(spotId, nonce), signature)) {
    return Response.json({ error: 'signature does not match this wallet' }, { status: 401 })
  }
  if (!consumeNonce(wallet, nonce)) {
    return Response.json({ error: 'nonce is unknown, expired or already used' }, { status: 401 })
  }

  const spot = getSpot(spotId)
  if (!spot) return Response.json({ error: 'no such spot' }, { status: 404 })
  if (spot.wallet !== wallet) {
    return Response.json({ error: 'that spot belongs to another wallet' }, { status: 403 })
  }
  if (spot.status !== 'live') {
    return Response.json({ error: 'spot is already released' }, { status: 409 })
  }

  const round = currentRound()
  releaseSpot(spotId, round?.id ?? 0, 'released by holder')
  bus.publish({ type: 'release', wallet, sector: spot.sector })

  return Response.json({ ok: true, spotId, depthLost: spot.depth })
}
