'use client'

import { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import bs58 from 'bs58'
import { toast } from 'sonner'
import { MEMO_PROGRAM_ID, memoText, withdrawMessage } from '@/lib/messages'

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? ''

export function useDeploy(onDone?: () => void) {
  const { connection } = useConnection()
  const { publicKey, sendTransaction, signMessage } = useWallet()
  const [busy, setBusy] = useState(false)

  async function deploy(sector: number, lamports: number) {
    if (!publicKey) return toast.error('connect a wallet first')
    if (!TREASURY) {
      return toast.error('NEXT_PUBLIC_TREASURY_ADDRESS is not configured')
    }

    setBusy(true)
    try {
      const tx = new Transaction()
        .add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(TREASURY),
            lamports,
          }),
        )
        .add(
          new TransactionInstruction({
            keys: [],
            programId: new PublicKey(MEMO_PROGRAM_ID),
            data: Buffer.from(memoText(sector), 'utf8'),
          }),
        )

      toast.info(`signing deploy into sector ${sector}`)
      const signature = await sendTransaction(tx, connection)

      toast.info('confirming on chain..')
      const latest = await connection.getLatestBlockhash()
      await connection.confirmTransaction({ signature, ...latest }, 'confirmed')

      // The server ignores everything we claim and re-reads the chain itself.
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, wallet: publicKey.toBase58() }),
      })
      const body = await res.json()

      if (!res.ok) {
        toast.error(body.error ?? 'deploy rejected')
        return
      }

      toast.success(`rig ${body.rigId} live in sector ${body.sector}`)
      onDone?.()
    } catch (err) {
      toast.error((err as Error).message || 'deploy failed')
    } finally {
      setBusy(false)
    }
  }

  async function withdraw(rigId: number) {
    if (!publicKey) return toast.error('connect a wallet first')
    if (!signMessage) return toast.error('this wallet cannot sign messages')

    setBusy(true)
    try {
      const wallet = publicKey.toBase58()
      const nonceRes = await fetch(`/api/nonce?wallet=${wallet}`)
      const { nonce } = await nonceRes.json()

      const message = withdrawMessage(rigId, nonce)
      const signed = await signMessage(new TextEncoder().encode(message))

      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          rigId,
          nonce,
          signature: bs58.encode(signed),
        }),
      })
      const body = await res.json()

      if (!res.ok) {
        toast.error(body.error ?? 'withdraw rejected')
        return
      }

      toast.success(`rig ${rigId} pulled · depth ${body.depthLost} lost`)
      onDone?.()
    } catch (err) {
      toast.error((err as Error).message || 'withdraw failed')
    } finally {
      setBusy(false)
    }
  }

  return { deploy, withdraw, busy, connected: !!publicKey, treasuryConfigured: !!TREASURY }
}
