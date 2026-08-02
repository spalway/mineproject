'use client'

import { useState } from 'react'
import { RoundDialog } from '@/components/history/RoundDialog'
import type { RoundRow } from '@/hooks/useStream'
import { pad, sol } from '@/lib/format'

export function RoundLog({
  rounds,
  carried,
  owed,
  paid,
  loaded,
}: {
  rounds: RoundRow[]
  carried: number
  owed: number
  paid: number
  loaded: boolean
}) {
  const [open, setOpen] = useState<number | null>(null)

  const resolved = rounds.filter((r) => r.status === 'resolved')
  const dark = rounds.filter((r) => r.status === 'void')
  const distributed = resolved.reduce(
    (sum, r) => sum + Math.max(0, r.pot_lamports - r.carried_lamports),
    0,
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Box label="rounds run" value={loaded ? String(rounds.length) : '--'} />
        <Box label="distributed" value={loaded ? sol(distributed, 4) : '--'} />
        <Box label="in the pot" value={loaded ? sol(carried, 4) : '--'} />
        <Box label="owed" value={loaded ? sol(owed, 4) : '--'} vein />
      </div>

      <div className="border border-pj-faint">
        <div className="pj-label pj-dim grid grid-cols-[3.5rem_4.5rem_1fr_5.5rem_5.5rem] gap-2 border-b border-pj-faint px-3 py-1 text-[11px]">
          <span>round</span>
          <span>top sector</span>
          <span>spots</span>
          <span className="text-right">pot</span>
          <span className="text-right">carried</span>
        </div>

        {/* Only claim there are none once we have actually looked. */}
        {loaded && rounds.length === 0 && (
          <div className="pj-dim px-3 py-8 text-center text-xs">
            no rounds have closed yet
          </div>
        )}

        <div className="max-h-[30rem] overflow-y-auto">
          {rounds.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpen(r.id)}
              className="grid w-full grid-cols-[3.5rem_4.5rem_1fr_5.5rem_5.5rem] items-center gap-2 border-b border-pj-faint/40 px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-pj-green/10"
            >
              <span className="pj-dim">r{r.id}</span>
              <span
                className={
                  r.status === 'void'
                    ? 'text-pj-amber'
                    : r.strike_sector === null
                      ? 'pj-dim'
                      : 'font-bold text-pj-red'
                }
              >
                {r.status === 'void'
                  ? 'dark'
                  : r.strike_sector === null
                    ? '-'
                    : pad(r.strike_sector)}
              </span>
              <span className="pj-dim">open log</span>
              <span className="text-right tabular-nums">{sol(r.pot_lamports, 4)}</span>
              <span className="pj-dim text-right tabular-nums">
                {sol(r.carried_lamports, 4)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border border-pj-faint p-3 text-xs">
          <div className="pj-label pj-dim mb-2 text-[11px]">record</div>
          <Row label="rounds settled" value={loaded ? String(resolved.length) : '--'} />
          <Row label="rounds dark" value={loaded ? String(dark.length) : '--'} />
          <Row label="paid out" value={loaded ? `${sol(paid, 4)} sol` : '--'} />
          <p className="pj-dim mt-3 text-[10px] leading-relaxed">
            click any round to open its log: the board as it stood, which sector
            came out on top, and exactly what each wallet received.
          </p>
        </div>

        <div className="border border-pj-faint p-3 text-xs">
          <div className="pj-label pj-dim mb-2 text-[11px]">a dark round</div>
          <p className="pj-dim text-[10px] leading-relaxed">
            occasionally a round closes dark. that means the pool could not
            measure the round to the standard it needs, so nothing is
            distributed and the entire pot rolls into the next one. nothing is
            lost and no result is estimated to fill the gap.
          </p>
        </div>
      </div>

      <RoundDialog roundId={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function Box({ label, value, vein }: { label: string; value: string; vein?: boolean }) {
  return (
    <div className={`border p-3 ${vein ? 'border-pj-amber/40' : 'border-pj-faint'}`}>
      <div className="pj-label pj-dim text-[10px] tracking-widest">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${vein ? 'pj-vein' : ''}`}>
        {value}
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
