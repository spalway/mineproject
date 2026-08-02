import { CONFIG } from '@/lib/config'
import { claimMessage } from '@/lib/messages'
import { isValidPubkey, tokenBalance, verifySignedMessage, TOKEN_MINT } from '@/lib/chain'
import { claimSpot, consumeNonce, currentRound, sectorTaken, spotByWallet } from '@/lib/db'
import { bus } from '@/lib/bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Claiming a spot costs nothing and moves nothing. The wallet signs a plain
 * message, we verify the signature, then independently read its token balance
 * from chain — the client never tells us what it holds.
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
  const sector = typeof body.sector === 'number' ? body.sector : null

  if (!wallet || !nonce || !signature || sector === null) {
    return Response.json(
      { error: 'wallet, sector, nonce and signature are required' },
      { status: 400 },
    )
  }
  if (!isValidPubkey(wallet)) {
    return Response.json({ error: 'not a valid wallet address' }, { status: 400 })
  }
  if (!Number.isInteger(sector) || sector < 0 || sector >= CONFIG.SECTOR_COUNT) {
    return Response.json({ error: 'sector out of range' }, { status: 400 })
  }

  // Signature first, so a bad one cannot burn someone's nonce.
  if (!verifySignedMessage(wallet, claimMessage(sector, nonce), signature)) {
    return Response.json({ error: 'signature does not match this wallet' }, { status: 401 })
  }
  if (!consumeNonce(wallet, nonce)) {
    return Response.json({ error: 'nonce is unknown, expired or already used' }, { status: 401 })
  }

  if (!TOKEN_MINT) {
    return Response.json(
      { error: 'token mint is not configured yet, claiming is closed' },
      { status: 503 },
    )
  }

  const tokens = await tokenBalance(wallet)
  if (tokens < CONFIG.MIN_TOKEN_BALANCE) {
    return Response.json(
      {
        error: `holding ${CONFIG.MIN_TOKEN_BALANCE.toLocaleString()} tokens is required to claim a spot`,
        tokens,
        required: CONFIG.MIN_TOKEN_BALANCE,
      },
      { status: 403 },
    )
  }

  if (spotByWallet(wallet)) {
    return Response.json({ error: 'this wallet already holds a spot' }, { status: 409 })
  }
  if (sectorTaken(sector)) {
    return Response.json({ error: 'that sector is already taken' }, { status: 409 })
  }

  const round = currentRound()
  if (!round) {
    return Response.json({ error: 'field is not open yet' }, { status: 503 })
  }

  let spotId: number
  try {
    spotId = claimSpot({ wallet, sector, tokens, round: round.id })
  } catch {
    // Unique index lost a race with a concurrent claim.
    return Response.json({ error: 'that sector was just taken' }, { status: 409 })
  }

  bus.publish({ type: 'claim', wallet, sector })

  return Response.json({ ok: true, spotId, sector, tokens, activeFromRound: round.id + 1 })
}
