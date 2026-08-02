'use client'

import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import bs58 from 'bs58'
import { toast } from 'sonner'
import { claimMessage, releaseMessage } from '@/lib/messages'

/**
 * Claiming and releasing are signature-only. No transaction is built, no
 * lamports move, and the user pays no network fee.
 */
export function useClaim(onDone?: () => void) {
  const { publicKey, signMessage } = useWallet()
  const [busy, setBusy] = useState(false)

  async function signed(message: string): Promise<string | null> {
    if (!signMessage) {
      toast.error('this wallet cannot sign messages')
      return null
    }
    const bytes = await signMessage(new TextEncoder().encode(message))
    return bs58.encode(bytes)
  }

  async function nonceFor(wallet: string): Promise<string | null> {
    const res = await fetch(`/api/nonce?wallet=${wallet}`)
    if (!res.ok) {
      toast.error('could not start a claim')
      return null
    }
    return (await res.json()).nonce as string
  }

  async function claim(sector: number) {
    if (!publicKey) return toast.error('connect a wallet first')

    setBusy(true)
    try {
      const wallet = publicKey.toBase58()
      const nonce = await nonceFor(wallet)
      if (!nonce) return

      const signature = await signed(claimMessage(sector, nonce))
      if (!signature) return

      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, sector, nonce, signature }),
      })
      const body = await res.json()

      if (!res.ok) {
        toast.error(body.error ?? 'claim rejected')
        return
      }

      toast.success(`sector ${String(sector).padStart(2, '0')} claimed`)
      onDone?.()
    } catch (err) {
      toast.error((err as Error).message || 'claim failed')
    } finally {
      setBusy(false)
    }
  }

  async function release(spotId: number) {
    if (!publicKey) return toast.error('connect a wallet first')

    setBusy(true)
    try {
      const wallet = publicKey.toBase58()
      const nonce = await nonceFor(wallet)
      if (!nonce) return

      const signature = await signed(releaseMessage(spotId, nonce))
      if (!signature) return

      const res = await fetch('/api/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, spotId, nonce, signature }),
      })
      const body = await res.json()

      if (!res.ok) {
        toast.error(body.error ?? 'release rejected')
        return
      }

      toast.success(`spot released, ${body.depthLost} depth given up`)
      onDone?.()
    } catch (err) {
      toast.error((err as Error).message || 'release failed')
    } finally {
      setBusy(false)
    }
  }

  return { claim, release, busy, connected: !!publicKey }
}
