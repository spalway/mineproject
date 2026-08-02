'use client'

import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useDeploy } from '@/hooks/useDeploy'
import { LAMPORTS_PER_SOL, pad, sol } from '@/lib/format'

const STEPS = [0.01, 0.1, 1]

export function DeployBar({
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
  const canDeploy =
    connected && treasuryConfigured && sector !== null && lamports >= minLamports && !busy

  const hint = !connected
    ? 'connect a wallet to deploy'
    : !treasuryConfigured
      ? 'treasury address not configured, deploys disabled'
      : sector === null
        ? 'select a sector on the field'
        : lamports > 0 && lamports < minLamports
          ? `minimum deploy is ${sol(minLamports)} sol`
          : lamports > 0
            ? `draw burns ${sol(Math.floor((lamports * drawBps) / 10_000), 5)} sol per epoch, rig goes live next epoch`
            : 'rig activates at the next epoch boundary'

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex flex-wrap items-stretch justify-center gap-2 text-[15px]">
        <div className="flex items-center gap-2 border border-pj-faint px-3">
          <span className="pj-dim text-[13px]">sector</span>
          <span className="text-[20px] text-pj-green">{sector === null ? '--' : pad(sector)}</span>
        </div>

        <div className="flex items-center gap-2 border border-pj-faint px-3 py-1.5">
          <span className="text-[20px]">{amount.toFixed(2)}</span>
          <span className="pj-dim text-[13px]">sol</span>
        </div>

        {STEPS.map((s) => (
          <button
            key={s}
            onClick={() => setAmount((a) => Number((a + s).toFixed(4)))}
            className="border border-pj-faint px-3 hover:border-pj-green hover:bg-pj-green/10"
          >
            +{s}
          </button>
        ))}

        <button
          onClick={() => {
            const max = balance === null ? 0 : Math.max(0, balance - 5_000_000)
            setAmount(Number((max / LAMPORTS_PER_SOL).toFixed(4)))
          }}
          disabled={balance === null}
          className="border border-pj-faint px-3 hover:border-pj-green hover:bg-pj-green/10 disabled:opacity-40"
        >
          max
        </button>

        <button
          onClick={() => setAmount(0)}
          className="border border-pj-faint px-3 pj-dim hover:border-pj-green hover:text-pj-green"
        >
          clear
        </button>

        <button
          onClick={() => sector !== null && void deploy(sector, lamports)}
          disabled={!canDeploy}
          className="border border-pj-green px-6 tracking-widest text-pj-green transition-colors hover:bg-pj-green hover:text-pj-bg disabled:border-pj-faint disabled:text-pj-faint disabled:hover:bg-transparent"
        >
          {busy ? 'deploying' : 'deploy'}
        </button>
      </div>

      <div className="pj-dim text-[13px]">
        {hint}
        {balance !== null && ` · balance ${sol(balance)} sol`}
      </div>
    </div>
  )
}
