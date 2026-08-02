'use client'

import type { RoundRow } from '@/hooks/useStream'
import { pad, sol } from '@/lib/format'

export function StrikeLog({
  rounds,
  strikeBps,
  riftBps,
  poolBps,
}: {
  rounds: RoundRow[]
  strikeBps: number
  riftBps: number
  poolBps: number
}) {
  const resolved = rounds.filter((r) => r.status === 'resolved')
  const voided = rounds.filter((r) => r.status === 'void')

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="border border-pj-faint">
        <div className="pj-label pj-dim grid grid-cols-[3.5rem_4rem_4rem_1fr_5rem] gap-2 border-b border-pj-faint px-3 py-1 text-[11px]">
          <span>round</span>
          <span>struck</span>
          <span>mints</span>
          <span className="text-right">pot</span>
          <span className="text-right">carried</span>
        </div>

        <div className="max-h-[26rem] overflow-y-auto">
          {rounds.length === 0 && (
            <div className="pj-dim px-3 py-6 text-center text-xs">
              no rounds resolved yet
            </div>
          )}

          {rounds.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[3.5rem_4rem_4rem_1fr_5rem] items-center gap-2 border-b border-pj-faint/40 px-3 py-1 text-[11px]"
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
              <span className="pj-dim tabular-nums">{r.mint_count}</span>
              <span className="text-right tabular-nums">{sol(r.pot_lamports, 4)}</span>
              <span className="pj-dim text-right tabular-nums">
                {sol(r.carried_lamports, 4)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="border border-pj-faint p-3 text-xs">
          <div className="pj-label pj-dim mb-2 text-[11px]">how a pot splits</div>
          <Row label="striking sector" value={`${strikeBps / 100}%`} />
          <Row label="rift around it" value={`${riftBps / 100}%`} />
          <Row label="every claimed spot" value={`${poolBps / 100}%`} />
          <p className="pj-dim mt-3 text-[10px] leading-relaxed">
            the sector graded highest strikes. a leg with no eligible recipients
            is carried into the next round rather than vanishing, which is why
            an empty board banks the whole pot instead of burning it.
          </p>
        </div>

        <div className="border border-pj-faint p-3 text-xs">
          <div className="pj-label pj-dim mb-2 text-[11px]">record</div>
          <Row label="rounds resolved" value={String(resolved.length)} />
          <Row label="rounds dark" value={String(voided.length)} />
          <Row
            label="total distributed"
            value={sol(
              resolved.reduce((sum, r) => sum + r.pot_lamports - r.carried_lamports, 0),
              4,
            )}
          />
          <p className="pj-dim mt-3 text-[10px] leading-relaxed">
            a dark round means the launch feed was down for more than a fifth of
            it. nothing strikes, nothing is distributed, and the pot rolls
            forward whole. we do not invent launches to fill a gap.
          </p>
        </div>
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
