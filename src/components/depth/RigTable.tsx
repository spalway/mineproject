'use client'

import { useCallback, useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useDeploy } from '@/hooks/useDeploy'
import { multiplier, pad, sol } from '@/lib/format'

type WalletRig = {
  id: number
  sector: number
  balance: number
  depth: number
  status: string
  weight: number
  drawPerEpoch: number
}

type Payout = {
  id: number
  epoch_id: number
  kind: string
  lamports: number
  signature: string | null
  status: string
}

export function RigTable({
  depthCap,
  depthK,
  epochMs,
}: {
  depthCap: number
  depthK: number
  epochMs: number
}) {
  const { publicKey } = useWallet()
  const [rigs, setRigs] = useState<WalletRig[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])

  const load = useCallback(async () => {
    if (!publicKey) {
      setRigs([])
      setPayouts([])
      return
    }
    const res = await fetch(`/api/wallet/${publicKey.toBase58()}`, { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    setRigs(data.rigs)
    setPayouts(data.payouts)
  }, [publicKey])

  const { withdraw, busy } = useDeploy(load)

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 10_000)
    return () => clearInterval(t)
  }, [load])

  const active = rigs.filter((r) => r.status === 'active')
  const capMinutes = Math.round((depthCap * epochMs) / 60_000)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="border border-pj-faint">
        <div className="pj-dim grid grid-cols-[3rem_4rem_1fr_4rem_5rem_4rem] gap-2 border-b border-pj-faint px-3 py-1 text-[11px]">
          <span>RIG</span>
          <span>SECTOR</span>
          <span>BALANCE</span>
          <span>DEPTH</span>
          <span>WEIGHT</span>
          <span />
        </div>

        {!publicKey && (
          <div className="pj-dim px-3 py-6 text-center text-xs">
            connect a wallet to see your rigs
          </div>
        )}

        {publicKey && active.length === 0 && (
          <div className="pj-dim px-3 py-6 text-center text-xs">
            no active rigs — deploy into a sector on the field above
          </div>
        )}

        {active.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[3rem_4rem_1fr_4rem_5rem_4rem] items-center gap-2 border-b border-pj-faint/40 px-3 py-1.5 text-xs"
          >
            <span className="pj-dim">#{r.id}</span>
            <span className="text-pj-green">{pad(r.sector)}</span>
            <span className="tabular-nums">{sol(r.balance)} SOL</span>
            <span className="tabular-nums">{r.depth}</span>
            <span className="tabular-nums text-pj-green">
              {multiplier(r.depth, depthCap, depthK).toFixed(2)}×
            </span>
            <button
              onClick={() => void withdraw(r.id)}
              disabled={busy}
              className="border border-pj-faint py-0.5 text-[10px] hover:border-pj-amber hover:text-pj-amber disabled:opacity-40"
            >
              PULL
            </button>
          </div>
        ))}

        {payouts.length > 0 && (
          <div className="border-t border-pj-faint">
            <div className="pj-dim px-3 py-1 text-[11px]">PAYOUT LEDGER</div>
            <div className="max-h-40 overflow-y-auto">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 border-b border-pj-faint/30 px-3 py-1 text-[11px]"
                >
                  <span className="pj-dim w-16">e{p.epoch_id}</span>
                  <span className={p.kind === 'vein' ? 'pj-vein w-16' : 'w-16'}>{p.kind}</span>
                  <span className="flex-1 tabular-nums">{sol(p.lamports, 5)}</span>
                  <span className={p.status === 'sent' ? 'text-pj-green' : 'text-pj-amber'}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border border-pj-faint p-3 text-xs">
        <div className="pj-dim mb-2 text-[11px]">DEPTH CURVE</div>
        <div className="space-y-0.5">
          {[0, 15, 30, 45, 60].map((d) => (
            <div key={d} className="flex items-center gap-2">
              <span className="pj-dim w-6 tabular-nums">{d}</span>
              <span className="flex-1 text-pj-green">
                {'█'.repeat(Math.round(multiplier(d, depthCap, depthK) * 6))}
              </span>
              <span className="tabular-nums">{multiplier(d, depthCap, depthK).toFixed(1)}×</span>
            </div>
          ))}
        </div>
        <p className="pj-dim mt-3 text-[10px] leading-relaxed">
          Depth is consecutive epochs survived. It caps at {depthCap} epochs
          (~{capMinutes} minutes) for a 3× weight multiplier. A strike does not
          reset it. Pulling a rig does — depth returns to zero.
        </p>
      </div>
    </div>
  )
}
