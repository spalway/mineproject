import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

export const NETWORK = (process.env.NETWORK ?? 'devnet') as 'devnet' | 'mainnet'

/**
 * The server holds no private key. Claiming a spot is a signed message and
 * payouts are made by hand from the treasury, so nothing here can move funds.
 * The worst a compromise of this process can do is lie about what is owed,
 * and the ledger is public.
 */

let connection: Connection | null = null
export function getConnection(): Connection {
  if (connection) return connection
  const url =
    process.env.RPC_URL ?? clusterApiUrl(NETWORK === 'mainnet' ? 'mainnet-beta' : 'devnet')
  connection = new Connection(url, 'confirmed')
  return connection
}

export const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT ?? ''
export const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? ''

/** Proves a wallet controls its key without moving anything. */
export function verifySignedMessage(
  wallet: string,
  message: string,
  signature: string,
): boolean {
  try {
    const pubkey = new PublicKey(wallet).toBytes()
    const sig = bs58.decode(signature)
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pubkey)
  } catch {
    return false
  }
}

/**
 * Whole-token balance of TOKEN_MINT held by `wallet`, summed across every
 * token account it owns. Returns 0 when no mint is configured, which keeps
 * the gate closed rather than open.
 */
export async function tokenBalance(wallet: string): Promise<number> {
  if (!TOKEN_MINT) return 0

  try {
    const res = await getConnection().getParsedTokenAccountsByOwner(new PublicKey(wallet), {
      mint: new PublicKey(TOKEN_MINT),
    })

    return res.value.reduce((sum, { account }) => {
      const amount = account.data.parsed?.info?.tokenAmount?.uiAmount
      return sum + (typeof amount === 'number' ? amount : 0)
    }, 0)
  } catch {
    return 0
  }
}

/** Lamports currently sitting in the treasury. Null if unreadable. */
export async function treasuryBalance(): Promise<number | null> {
  if (!TREASURY_ADDRESS) return null
  try {
    return await getConnection().getBalance(new PublicKey(TREASURY_ADDRESS))
  } catch {
    return null
  }
}

export function isValidPubkey(value: string): boolean {
  try {
    new PublicKey(value)
    return true
  } catch {
    return false
  }
}

export function explorerTx(signature: string): string {
  const cluster = NETWORK === 'mainnet' ? '' : '?cluster=devnet'
  return `https://solscan.io/tx/${signature}${cluster}`
}

export function explorerAccount(address: string): string {
  const cluster = NETWORK === 'mainnet' ? '' : '?cluster=devnet'
  return `https://solscan.io/account/${address}${cluster}`
}
