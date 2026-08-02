'use client'

import type { Spot } from '@/hooks/useStream'
import { pad, shortKey } from '@/lib/format'

export function RiftMap({
  rifts,
  spots,
  gridSize,
  riftBps,
}: {
  rifts: number[][]
  spots: Spot[]
  gridSize: number
  riftBps: number
}) {
  const ranked = rifts
    .map((sectors) => {
      const members = spots.filter((s) => sectors.includes(s.sector))
      return {
        sectors,
        wallets: new Set(members.map((s) => s.wallet)).size,
        depth: members.reduce((sum, s) => sum + s.depth, 0),
        members,
      }
    })
    .sort((a, b) => b.sectors.length - a.sectors.length || b.depth - a.depth)

  const fractures = ranked.filter((r) => r.sectors.length > 1)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="border border-pj-faint">
        <div className="pj-label pj-dim grid grid-cols-[3.5rem_1fr_5rem_5rem] gap-2 border-b border-pj-faint px-3 py-1 text-[11px]">
          <span>size</span>
          <span>sectors</span>
          <span className="text-right">wallets</span>
          <span className="text-right">depth</span>
        </div>

        {ranked.length === 0 && (
          <div className="pj-dim px-3 py-6 text-center text-xs">
            field is empty, so there are no fractures
          </div>
        )}

        {ranked.slice(0, 14).map((r) => (
          <div
            key={r.sectors.join('-')}
            className="grid grid-cols-[3.5rem_1fr_5rem_5rem] items-center gap-2 border-b border-pj-faint/40 px-3 py-1.5 text-xs"
          >
            <span className={r.sectors.length > 1 ? 'font-bold text-pj-green' : 'pj-dim'}>
              {r.sectors.length}
            </span>
            <span className="truncate">{r.sectors.map((s) => pad(s)).join(' ')}</span>
            <span className="pj-dim text-right tabular-nums">{r.wallets}</span>
            <span className="text-right tabular-nums">{r.depth}</span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="border border-pj-faint p-3 text-xs">
          <div className="pj-label pj-dim mb-2 text-[11px]">fracture state</div>
          <Row label="components" value={String(ranked.length)} />
          <Row label="fractured" value={String(fractures.length)} />
          <Row
            label="largest"
            value={ranked.length > 0 ? `${ranked[0].sectors.length} sectors` : '-'}
          />
          <Row label="claimed" value={`${spots.length} spots`} />
        </div>

        <div className="border border-pj-faint p-3">
          <p className="pj-dim text-[10px] leading-relaxed">
            a rift is a connected run of claimed sectors, counted across every
            wallet, so you benefit from strangers claiming beside you. when a
            sector strikes, claimed sectors within two hops share{' '}
            {riftBps / 100}% of the pot. isolated cells claim nothing from that
            leg, though they still earn from the pool leg. the {gridSize}x
            {gridSize} field does not wrap at the edges.
          </p>
        </div>

        {fractures.length > 0 && (
          <div className="border border-pj-faint p-3">
            <div className="pj-label pj-dim mb-2 text-[11px]">largest crew</div>
            <div className="space-y-1 text-[11px]">
              {fractures[0].members.map((m) => (
                <div key={m.id} className="flex justify-between">
                  <span className="pj-dim">{shortKey(m.wallet, 4)}</span>
                  <span>{pad(m.sector)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
