import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { CONFIG } from './config'

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

export const NETWORK = (process.env.NETWORK ?? 'devnet') as 'devnet' | 'mainnet'

/** `PJ1:<sector>` -> sector, or null if it isn't ours / is out of range. */
export function parseMemo(memo: string): number | null {
  const m = new RegExp(`^${CONFIG.MEMO_TAG}:(\\d{1,3})$`).exec(memo.trim())
  if (!m) return null
  const sector = Number(m[1])
  if (!Number.isInteger(sector) || sector < 0 || sector >= CONFIG.SECTOR_COUNT) return null
  return sector
}

export function memoInstruction(sector: number): TransactionInstruction {
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(`${CONFIG.MEMO_TAG}:${sector}`, 'utf8'),
  })
}

/** Proves a wallet controls its key without moving funds. Used for withdraw auth. */
export function verifySignedMessage(wallet: string, message: string, signature: string): boolean {
  try {
    const pubkey = new PublicKey(wallet).toBytes()
    const sig = bs58.decode(signature)
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pubkey)
  } catch {
    return false
  }
}

let connection: Connection | null = null
export function getConnection(): Connection {
  if (connection) return connection
  const url =
    process.env.RPC_URL ?? clusterApiUrl(NETWORK === 'mainnet' ? 'mainnet-beta' : 'devnet')
  connection = new Connection(url, 'confirmed')
  return connection
}

let treasury: Keypair | null = null
export function getTreasury(): Keypair {
  if (treasury) return treasury
  const raw = process.env.TREASURY_SECRET_KEY
  if (!raw) throw new Error('TREASURY_SECRET_KEY is not set')

  const secret = raw.trim().startsWith('[')
    ? Uint8Array.from(JSON.parse(raw) as number[])
    : bs58.decode(raw.trim())

  treasury = Keypair.fromSecretKey(secret)
  return treasury
}

export function treasuryPubkey(): PublicKey {
  return getTreasury().publicKey
}

export type DeployVerdict =
  | { ok: true; lamports: number; sector: number }
  | { ok: false; reason: string }

/**
 * Re-reads the chain rather than trusting anything the client claims. A deploy
 * only counts if the transaction really moved lamports to the treasury and
 * really carried our memo.
 */
export async function verifyDeploy(signature: string, wallet: string): Promise<DeployVerdict> {
  const conn = getConnection()

  const tx = await conn.getParsedTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  })

  if (!tx) return { ok: false, reason: 'transaction not found or not yet confirmed' }
  if (tx.meta?.err) return { ok: false, reason: 'transaction failed on chain' }

  const keys = tx.transaction.message.accountKeys
  const feePayer = keys[0]?.pubkey?.toBase58()
  if (feePayer !== wallet) {
    return { ok: false, reason: 'fee payer does not match the claimed wallet' }
  }

  const blockTime = tx.blockTime
  if (!blockTime || Math.abs(Date.now() / 1000 - blockTime) > 300) {
    return { ok: false, reason: 'transaction is outside the accepted time window' }
  }

  const treasuryAddr = treasuryPubkey().toBase58()
  let lamports = 0
  let sector: number | null = null

  const instructions = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions),
  ]

  for (const ix of instructions) {
    if (!('parsed' in ix)) continue

    if (ix.program === 'system' && ix.parsed?.type === 'transfer') {
      const info = ix.parsed.info as { destination?: string; lamports?: number }
      if (info.destination === treasuryAddr && typeof info.lamports === 'number') {
        lamports += info.lamports
      }
    }

    if (ix.program === 'spl-memo' && typeof ix.parsed === 'string') {
      const parsed = parseMemo(ix.parsed)
      if (parsed !== null) sector = parsed
    }
  }

  if (lamports === 0) return { ok: false, reason: 'no transfer to the treasury found' }
  if (lamports < CONFIG.MIN_DEPLOY_LAMPORTS) {
    return { ok: false, reason: 'deploy is below the minimum' }
  }
  if (sector === null) return { ok: false, reason: 'missing or malformed sector memo' }

  return { ok: true, lamports, sector }
}

/** Up to 10 transfers per transaction. Returns the signature. */
export async function sendBatch(
  transfers: { to: string; lamports: number }[],
): Promise<string> {
  if (transfers.length === 0) throw new Error('sendBatch called with no transfers')

  const payer = getTreasury()
  const tx = new Transaction()
  for (const t of transfers) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: new PublicKey(t.to),
        lamports: t.lamports,
      }),
    )
  }

  return sendAndConfirmTransaction(getConnection(), tx, [payer], {
    commitment: 'confirmed',
  })
}

export function explorerTx(signature: string): string {
  const suffix = NETWORK === 'mainnet' ? '' : '?cluster=devnet'
  return `https://solscan.io/tx/${signature}${suffix}`
}
