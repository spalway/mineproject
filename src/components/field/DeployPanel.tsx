'use client'

import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useDeploy } from '@/hooks/useDeploy'
import { LAMPORTS_PER_SOL, pad, sol } from '@/lib/format'

const STEPS = [0.01, 0.1, 1]

export function DeployPanel({
  sector,
  minLamports,
  drawBps,
  onDeployed,
}: {
  sector: number | null
  minLamports: number
  drawBps: number
  onDeployed: () => void
}) {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const { deploy, busy, connected, treasuryConfigured } = useDeploy(onDeployed)

  const [amount, setAmount] = useState(0)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!publicKey) return setBalance(null)
    let cancelled = false
    void connection.getBalance(publicKey).then((b) => {
      if (!cancelled) setBalance(b)
    })
    return () => {
      cancelled = true
    }
  }, [publicKey, connection])

  const lamports = Math.round(amount * LAMPORTS_PER_SOL)
  const belowMin = lamports > 0 && lamports < minLamports
  const canDeploy =
    connected && treasuryConfigured && sector !== null && lamports >= minLamports && !busy

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="pj-dim">TARGET SECTOR</span>
        <span className="text-lg">{sector === null ? '--' : pad(sector)}</span>
      </div>

      <div className="border border-pj-faint px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl tabular-nums">{amount.toFixed(2)}</span>
          <span className="pj-dim text-xs">SOL</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-xs">
        {STEPS.map((s) => (
          <button
            key={s}
            onClick={() => setAmount((a) => Number((a + s).toFixed(4)))}
            className="border border-pj-faint py-1 hover:border-pj-green hover:bg-pj-green/10"
          >
            +{s}
          </button>
        ))}
        <button
          onClick={() => {
            // Leave a little behind for transaction fees.
            const max = balance === null ? 0 : Math.max(0, balance - 5_000_000)
            setAmount(Number((max / LAMPORTS_PER_SOL).toFixed(4)))
          }}
          disabled={balance === null}
          className="border border-pj-faint py-1 hover:border-pj-green hover:bg-pj-green/10 disabled:opacity-40"
        >
          MAX
        </button>
      </div>

      <div className="flex justify-between text-xs">
        <button onClick={() => setAmount(0)} className="pj-dim hover:text-pj-green">
          [clear]
        </button>
        <span className="pj-dim">
          {balance === null ? 'wallet not linked' : `balance ${sol(balance)} SOL`}
        </span>
      </div>

      <button
        onClick={() => sector !== null && void deploy(sector, lamports)}
        disabled={!canDeploy}
        className="border border-pj-green py-2 tracking-widest text-pj-green transition-colors hover:bg-pj-green hover:text-pj-bg disabled:border-pj-faint disabled:text-pj-faint disabled:hover:bg-transparent"
      >
        {busy ? 'DEPLOYING..' : 'DEPLOY'}
      </button>

      <div className="pj-dim space-y-0.5 text-[11px] leading-relaxed">
        {!connected && <div>› connect a wallet to deploy</div>}
        {connected && !treasuryConfigured && (
          <div className="text-pj-amber">› treasury address not configured — deploys disabled</div>
        )}
        {sector === null && <div>› select a sector on the field</div>}
        {belowMin && <div>› minimum deploy is {sol(minLamports)} SOL</div>}
        {lamports > 0 && (
          <div>
            › draw burns {sol(Math.floor((lamports * drawBps) / 10_000), 5)} SOL per epoch
          </div>
        )}
        <div>› rig activates at the next epoch boundary</div>
      </div>
    </div>
  )
}
