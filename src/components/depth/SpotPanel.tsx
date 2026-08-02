'use client'

import { useCallback, useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useClaim } from '@/hooks/useClaim'
import { multiplier, pad, sol } from '@/lib/format'

type Payout = {
  id: number
  round_id: number
  kind: string
  lamports: number
  status: string
  signature: string | null
}

type WalletData = {
  tokens: number
  eligible: boolean
  required: number
  spot: { id: number; sector: number; depth: number; weight: number } | null
  owed: number
  paid: number
  payouts: Payout[]
}

export function SpotPanel({
  depthCap,
  depthK,
  roundMs,
}: {
  depthCap: number
  depthK: number
  roundMs: number
}) {
  const { publicKey } = useWallet()
  const [data, setData] = useState<WalletData | null>(null)

  const load = useCallback(async () => {
    if (!publicKey) return setData(null)
    const res = await fetch(`/api/wallet/${publicKey.toBase58()}`, { cache: 'no-store' })
    if (res.ok) setData(await res.json())
  }, [publicKey])

  const { release, busy } = useClaim(load)

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 15_000)
    return () => clearInterval(t)
  }, [load])

  const capMinutes = Math.round((depthCap * roundMs) / 60_000)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="border border-pj-faint">
          <div className="pj-label pj-dim border-b border-pj-faint px-3 py-1 text-[11px]">
            your spot
          </div>

          {!publicKey && (
            <div className="pj-dim px-3 py-6 text-center text-xs">
              connect a wallet to see your spot
            </div>
          )}

          {publicKey && !data?.spot && (
            <div className="pj-dim px-3 py-6 text-center text-xs">
              no spot held. claim an open sector on the field.
            </div>
          )}

          {data?.spot && (
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
              <Cell label="sector" value={pad(data.spot.sector)} />
              <Cell label="depth" value={String(data.spot.depth)} />
              <Cell label="weight" value={`${data.spot.weight.toFixed(2)}x`} />
              <div className="flex flex-col justify-end">
                <button
                  onClick={() => void release(data.spot!.id)}
                  disabled={busy}
                  className="border border-pj-faint py-1 text-[11px] hover:border-pj-amber hover:text-pj-amber disabled:opacity-40"
                >
                  release
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border border-pj-faint">
          <div className="pj-label pj-dim grid grid-cols-[4rem_5rem_1fr_5rem] gap-2 border-b border-pj-faint px-3 py-1 text-[11px]">
            <span>round</span>
            <span>leg</span>
            <span className="text-right">amount</span>
            <span className="text-right">status</span>
          </div>

          {(!data || data.payouts.length === 0) && (
            <div className="pj-dim px-3 py-6 text-center text-xs">no earnings yet</div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {data?.payouts.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[4rem_5rem_1fr_5rem] items-center gap-2 border-b border-pj-faint/40 px-3 py-1 text-[11px]"
              >
                <span className="pj-dim">r{p.round_id}</span>
                <span>{p.kind}</span>
                <span className="text-right tabular-nums">{sol(p.lamports, 5)}</span>
                <span className={p.status === 'paid' ? 'text-right text-pj-green' : 'text-right text-pj-amber'}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>

          {data && (
            <div className="flex justify-between border-t border-pj-faint px-3 py-2 text-[11px]">
              <span className="pj-dim">
                owed <span className="pj-vein font-bold">{sol(data.owed, 5)}</span> sol
              </span>
              <span className="pj-dim">
                paid <span className="font-bold text-pj-green">{sol(data.paid, 5)}</span> sol
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="border border-pj-faint p-3 text-xs">
          <div className="pj-label pj-dim mb-2 text-[11px]">depth curve</div>
          <div className="space-y-0.5">
            {[0, depthCap / 4, depthCap / 2, (depthCap * 3) / 4, depthCap].map((d) => (
              <div key={d} className="flex items-center gap-2">
                <span className="pj-dim w-6 tabular-nums">{d}</span>
                <span className="flex-1 text-pj-green">
                  {'#'.repeat(Math.round(multiplier(d, depthCap, depthK) * 6))}
                </span>
                <span className="tabular-nums">
                  {multiplier(d, depthCap, depthK).toFixed(1)}x
                </span>
              </div>
            ))}
          </div>
          <p className="pj-dim mt-3 text-[10px] leading-relaxed">
            depth is consecutive rounds held. it caps at {depthCap} rounds (~
            {capMinutes} minutes) for a 3x weight multiplier. depth costs nothing
            to accrue — it only rewards not churning your spot. releasing resets
            it to zero, but anything already owed stays owed.
          </p>
        </div>

        <div className="border border-pj-amber/40 p-3">
          <div className="pj-label pj-vein mb-1 text-[11px]">settlement</div>
          <p className="pj-dim text-[10px] leading-relaxed">
            this ledger records what you have earned. a row moves from{' '}
            <span className="pj-vein">owed</span> to{' '}
            <span className="text-pj-green">paid</span> once the treasury sends it
            and its transaction signature is attached, so every settlement can be
            followed on chain. amounts already earned stay here whether or not you
            keep your spot.
          </p>
        </div>
      </div>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="pj-label pj-dim text-[10px] tracking-widest">{label}</span>
    </div>
  )
}
