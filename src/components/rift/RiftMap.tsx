'use client'

import type { Rig } from '@/hooks/useStream'
import { pad, sol } from '@/lib/format'

export function RiftMap({
  rifts,
  rigs,
  gridSize,
}: {
  rifts: number[][]
  rigs: Rig[]
  gridSize: number
}) {
  const ranked = rifts
    .map((sectors) => {
      const members = rigs.filter((r) => sectors.includes(r.sector))
      return {
        sectors,
        wallets: new Set(members.map((r) => r.wallet)).size,
        staked: members.reduce((sum, r) => sum + r.balance, 0),
      }
    })
    .sort((a, b) => b.sectors.length - a.sectors.length || b.staked - a.staked)

  const fractures = ranked.filter((r) => r.sectors.length > 1)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="border border-pj-faint">
        <div className="pj-dim grid grid-cols-[4rem_1fr_5rem_6rem] gap-2 border-b border-pj-faint px-3 py-1 text-[11px]">
          <span>size</span>
          <span>sectors</span>
          <span>wallets</span>
          <span className="text-right">staked</span>
        </div>

        {ranked.length === 0 && (
          <div className="pj-dim px-3 py-6 text-center text-xs">
            field is empty — no rigs, no fractures
          </div>
        )}

        {ranked.slice(0, 12).map((r) => (
          <div
            key={r.sectors.join('-')}
            className="grid grid-cols-[4rem_1fr_5rem_6rem] items-center gap-2 border-b border-pj-faint/40 px-3 py-1.5 text-xs"
          >
            <span className={r.sectors.length > 1 ? 'text-pj-green' : 'pj-dim'}>
              {r.sectors.length}
            </span>
            <span className="truncate">{r.sectors.map((s) => pad(s)).join(' ')}</span>
            <span className="pj-dim tabular-nums">{r.wallets}</span>
            <span className="text-right tabular-nums">{sol(r.staked)} sol</span>
          </div>
        ))}
      </div>

      <div className="border border-pj-faint p-3 text-xs">
        <div className="pj-dim mb-2 text-[11px]">fracture state</div>
        <div className="space-y-1">
          <Row label="components" value={String(ranked.length)} />
          <Row label="fractured" value={String(fractures.length)} />
          <Row
            label="largest"
            value={ranked.length > 0 ? `${ranked[0].sectors.length} sectors` : '—'}
          />
          <Row label="occupied" value={`${rigs.length} rigs`} />
        </div>

        <p className="pj-dim mt-3 text-[10px] leading-relaxed">
          a rift is a connected run of occupied sectors, counted across every
          wallet, so you benefit from strangers deploying beside you. when a
          sector strikes, occupied sectors within two hops claim 15% of the pot.
          isolated cells claim nothing. the {gridSize}x{gridSize} field does not
          wrap at the edges.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="pj-dim">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
