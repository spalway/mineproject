import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { getStore } from './store'

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

/**
 * Config table first, env second. That ordering is what lets the token CA be
 * dropped in at runtime and take effect on the next request, with no rebuild.
 */
async function fromConfigOrEnv(key: string, envVar: string | undefined): Promise<string> {
  try {
    const fromDb = await getStore().configGet(key)
    if (fromDb && isValidPubkey(fromDb)) return fromDb
  } catch {
    // Config unreadable is not fatal: fall through to the env value rather
    // than taking the whole page down.
  }
  const fromEnv = (envVar ?? '').trim()
  return fromEnv && isValidPubkey(fromEnv) ? fromEnv : ''
}

export function getTokenMint(): Promise<string> {
  return fromConfigOrEnv('token_mint', process.env.NEXT_PUBLIC_TOKEN_MINT)
}

export function getTreasuryAddress(): Promise<string> {
  return fromConfigOrEnv('treasury_address', process.env.NEXT_PUBLIC_TREASURY_ADDRESS)
}

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
 * token account it owns.
 *
 * Returns `null` when the balance could not be READ, which is deliberately
 * distinct from `0`. A throttled or briefly-down RPC must never be mistaken
 * for "this wallet sold everything" — that would evict holders from the board
 * for an outage they had nothing to do with.
 *
 * Returns 0 (a real answer) when no mint is configured, so the claim gate
 * fails closed rather than open.
 */
export async function tokenBalance(wallet: string): Promise<number | null> {
  const mint = await getTokenMint()
  if (!mint) return 0

  try {
    const res = await getConnection().getParsedTokenAccountsByOwner(new PublicKey(wallet), {
      mint: new PublicKey(mint),
    })

    return res.value.reduce((sum, { account }) => {
      const amount = account.data.parsed?.info?.tokenAmount?.uiAmount
      return sum + (typeof amount === 'number' ? amount : 0)
    }, 0)
  } catch (err) {
    console.warn(`[chain] balance read failed for ${wallet}: ${(err as Error).message}`)
    return null
  }
}

/** Lamports currently sitting in the treasury. Null if unreadable. */
export async function treasuryBalance(): Promise<number | null> {
  const address = await getTreasuryAddress()
  if (!address) return null
  try {
    return await getConnection().getBalance(new PublicKey(address))
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
