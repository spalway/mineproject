import { verifyDeploy } from '@/lib/chain'
import { consumeSignature, createRig, currentEpoch } from '@/lib/db'
import { bus } from '@/lib/bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The client hands us a signature and nothing else that we trust. We re-read
 * the transaction from chain and verify destination, amount, memo, fee payer
 * and recency ourselves before a rig exists.
 */
export async function POST(req: Request) {
  let body: { signature?: unknown; wallet?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'malformed request body' }, { status: 400 })
  }

  const signature = typeof body.signature === 'string' ? body.signature : null
  const wallet = typeof body.wallet === 'string' ? body.wallet : null

  if (!signature || !wallet) {
    return Response.json({ error: 'signature and wallet are required' }, { status: 400 })
  }

  const verdict = await verifyDeploy(signature, wallet)
  if (!verdict.ok) {
    return Response.json({ error: verdict.reason }, { status: 400 })
  }

  // Replay guard, after verification so a bad request cannot burn a signature.
  if (!consumeSignature(signature)) {
    return Response.json({ error: 'this deploy has already been counted' }, { status: 409 })
  }

  const epoch = currentEpoch()
  if (!epoch) {
    return Response.json({ error: 'field is not open yet' }, { status: 503 })
  }

  let rigId: number
  try {
    rigId = createRig({
      wallet,
      sector: verdict.sector,
      lamports: verdict.lamports,
      sig: signature,
      epoch: epoch.id,
    })
  } catch {
    return Response.json({ error: 'this deploy has already been counted' }, { status: 409 })
  }

  bus.publish({
    type: 'deploy',
    wallet,
    sector: verdict.sector,
    lamports: verdict.lamports,
  })

  return Response.json({
    ok: true,
    rigId,
    sector: verdict.sector,
    lamports: verdict.lamports,
    activatesInEpoch: epoch.id + 1,
  })
}
