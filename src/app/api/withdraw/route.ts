import { verifySignedMessage } from '@/lib/chain'
import { withdrawMessage } from '@/lib/messages'
import { closeRig, consumeNonce, currentEpoch, getRig, recordPayout } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Withdrawing needs proof of key ownership but must not move funds to do it,
 * so the wallet signs a nonce instead. Signature is checked BEFORE the nonce is
 * consumed, so a bad signature cannot burn someone's nonce.
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
  const rigId = typeof body.rigId === 'number' ? body.rigId : null

  if (!wallet || !nonce || !signature || rigId === null) {
    return Response.json(
      { error: 'wallet, rigId, nonce and signature are required' },
      { status: 400 },
    )
  }

  if (!verifySignedMessage(wallet, withdrawMessage(rigId, nonce), signature)) {
    return Response.json({ error: 'signature does not match this wallet' }, { status: 401 })
  }

  if (!consumeNonce(wallet, nonce)) {
    return Response.json({ error: 'nonce is unknown, expired or already used' }, { status: 401 })
  }

  const rig = getRig(rigId)
  if (!rig) return Response.json({ error: 'no such rig' }, { status: 404 })
  if (rig.wallet !== wallet) {
    return Response.json({ error: 'this rig belongs to another wallet' }, { status: 403 })
  }
  if (rig.status !== 'active') {
    return Response.json({ error: 'rig is already closed' }, { status: 409 })
  }

  const epoch = currentEpoch()
  const balance = rig.balance

  if (balance > 0) {
    recordPayout({
      epochId: epoch?.id ?? 0,
      wallet,
      rigId,
      kind: 'withdraw',
      lamports: balance,
    })
  }
  closeRig(rigId, epoch?.id ?? 0)

  return Response.json({ ok: true, rigId, returned: balance, depthLost: rig.depth })
}
