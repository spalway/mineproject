'use client'

import type { EpochRow } from '@/hooks/useStream'
import { pad, pumpUrl, shortKey, sol } from '@/lib/format'

export function VeinPanel({
  vein,
  epochs,
  migrations,
}: {
  vein: number
  epochs: EpochRow[]
  migrations: { mint: string; sector: number; received_at: number }[]
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="flex flex-col gap-4">
        <div className="border border-pj-amber/40 p-4 text-center">
          <div className="pj-dim text-[11px]">VEIN BALANCE</div>
          <div className="pj-vein mt-1 text-3xl tabular-nums">{sol(vein)}</div>
          <div className="pj-dim text-[11px]">SOL</div>
        </div>

        <div className="border border-pj-faint p-3">
          <div className="pj-dim mb-2 text-[11px]">RECENT GRADUATIONS</div>
          {migrations.length === 0 ? (
            <div className="pj-dim text-xs">none observed yet</div>
          ) : (
            <div className="space-y-1 text-xs">
              {migrations.map((m) => (
                <a
                  key={m.mint}
                  href={pumpUrl(m.mint)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex justify-between hover:text-pj-amber"
                >
                  <span className="pj-vein">{pad(m.sector)}</span>
                  <span className="pj-dim">{shortKey(m.mint, 5)}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <p className="pj-dim text-[10px] leading-relaxed">
          The vein takes 6% of every pot, plus the whole distributable pot
          whenever the striking sector holds no rigs. It only pays out when a
          real bonding-curve graduation lands inside the striking sector.
        </p>
      </div>

      <div className="border border-pj-faint">
        <div className="pj-dim grid grid-cols-[4rem_4rem_1fr_5rem_5rem] gap-2 border-b border-pj-faint px-3 py-1 text-[11px]">
          <span>EPOCH</span>
          <span>STRIKE</span>
          <span>MINTS</span>
          <span className="text-right">POT</span>
          <span className="text-right">VEIN</span>
        </div>

        <div className="max-h-[26rem] overflow-y-auto">
          {epochs.length === 0 && (
            <div className="pj-dim px-3 py-6 text-center text-xs">
              no epochs resolved yet<span className="pj-cursor" />
            </div>
          )}

          {epochs.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[4rem_4rem_1fr_5rem_5rem] items-center gap-2 border-b border-pj-faint/40 px-3 py-1 text-xs"
            >
              <span className="pj-dim">e{e.id}</span>
              <span className={e.status === 'void' ? 'text-pj-amber' : 'text-pj-green'}>
                {e.status === 'void' ? 'DARK' : e.strike_sector === null ? '—' : pad(e.strike_sector)}
              </span>
              <span className="pj-dim tabular-nums">{e.mint_count}</span>
              <span className="text-right tabular-nums">{sol(e.pot_lamports, 4)}</span>
              <span
                className={
                  e.vein_paid_lamports > 0 ? 'pj-vein text-right tabular-nums' : 'pj-dim text-right'
                }
              >
                {e.vein_paid_lamports > 0 ? sol(e.vein_paid_lamports, 3) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
