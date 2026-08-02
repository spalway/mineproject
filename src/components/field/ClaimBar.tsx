'use client'

import { useCallback, useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useClaim } from '@/hooks/useClaim'
import { pad } from '@/lib/format'

export type WalletInfo = {
  tokens: number
  eligible: boolean
  required: number
  spot: { id: number; sector: number; depth: number } | null
  owed: number
}

export function useWalletInfo() {
  const { publicKey } = useWallet()
  const [info, setInfo] = useState<WalletInfo | null>(null)

  const load = useCallback(async () => {
    if (!publicKey) return setInfo(null)
    try {
      const res = await fetch(`/api/wallet/${publicKey.toBase58()}`, { cache: 'no-store' })
      if (res.ok) setInfo(await res.json())
    } catch {
      // transient
    }
  }, [publicKey])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 30_000)
    return () => clearInterval(t)
  }, [load])

  return { info, reload: load }
}

export function ClaimBar({
  sector,
  minTokens,
  tokenMint,
  info,
  onChanged,
}: {
  sector: number | null
  minTokens: number
  tokenMint: string
  info: WalletInfo | null
  onChanged: () => void
}) {
  const { claim, release, busy, connected } = useClaim(onChanged)

  const held = info?.spot ?? null
  const eligible = info?.eligible ?? false

  const canClaim =
    connected && !!tokenMint && eligible && !held && sector !== null && !busy

  const hint = !connected
    ? 'connect a wallet to claim a spot'
    : !tokenMint
      ? 'token mint not configured yet, claiming is closed'
      : !eligible
        ? `hold ${minTokens.toLocaleString()} tokens to claim a spot` +
          (info ? ` · you hold ${Math.floor(info.tokens).toLocaleString()}` : '')
        : held
          ? `you hold sector ${pad(held.sector)} at depth ${held.depth}`
          : sector === null
            ? 'select an open sector on the field'
            : 'claiming costs nothing and moves no funds'

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex flex-wrap items-stretch justify-center gap-2 text-xs">
        <div className="flex items-center gap-2 border border-pj-faint px-3 py-1.5">
          <span className="pj-label pj-dim text-[10px]">sector</span>
          <span className="text-base font-bold text-pj-green">
            {sector === null ? '--' : pad(sector)}
          </span>
        </div>

        <div className="flex items-center gap-2 border border-pj-faint px-3 py-1.5">
          <span className="pj-label pj-dim text-[10px]">you hold</span>
          <span className="text-base tabular-nums">
            {info ? Math.floor(info.tokens).toLocaleString() : '--'}
          </span>
        </div>

        {held ? (
          <button
            onClick={() => void release(held.id)}
            disabled={busy}
            className="border border-pj-faint px-6 font-bold tracking-widest hover:border-pj-amber hover:text-pj-amber disabled:opacity-40"
          >
            {busy ? 'signing' : 'release spot'}
          </button>
        ) : (
          <button
            onClick={() => sector !== null && void claim(sector)}
            disabled={!canClaim}
            className="border border-pj-green px-6 font-bold tracking-widest text-pj-green transition-colors hover:bg-pj-green hover:text-pj-bg disabled:border-pj-faint disabled:text-pj-faint disabled:hover:bg-transparent"
          >
            {busy ? 'signing' : 'claim spot'}
          </button>
        )}
      </div>

      <div className="pj-dim text-center text-[11px]">{hint}</div>
    </div>
  )
}
