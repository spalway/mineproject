import { randomBytes } from 'node:crypto'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get('wallet')
  if (!wallet) {
    return Response.json({ error: 'wallet is required' }, { status: 400 })
  }

  const nonce = randomBytes(16).toString('hex')
  await getStore().issueNonce(wallet, nonce)

  return Response.json({ nonce })
}
