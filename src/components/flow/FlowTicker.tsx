'use client'

import type { MintRow } from '@/hooks/useStream'
import { pad, pumpUrl, shortKey } from '@/lib/format'

export function FlowTicker({ mints, grades }: { mints: MintRow[]; grades: number[] }) {
  const hot = grades
    .map((g, sector) => ({ sector, g }))
    .filter((x) => x.g > 0)
    .sort((a, b) => b.g - a.g)
    .slice(0, 8)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="border border-pj-faint">
        <div className="pj-dim flex gap-4 border-b border-pj-faint px-3 py-1 text-[11px]">
          <span className="w-14">sector</span>
          <span className="w-24">symbol</span>
          <span className="flex-1">mint</span>
          <span className="w-20 shrink-0 text-right">link</span>
        </div>

        <div className="max-h-[22rem] overflow-y-auto">
          {mints.length === 0 && (
            <div className="pj-dim px-3 py-6 text-center text-xs">
              waiting for the first launch of this epoch<span className="pj-cursor" />
            </div>
          )}

          {mints.map((m) => (
            <div
              key={m.mint}
              className="flex items-center gap-4 border-b border-pj-faint/40 px-3 py-1 text-xs hover:bg-pj-green/5"
            >
              <span className="w-14 text-pj-green">{pad(m.sector)}</span>
              <span className="w-24 truncate">{m.symbol ?? '—'}</span>
              <span className="pj-dim flex-1 truncate">{shortKey(m.mint, 6)}</span>
              <a
                href={pumpUrl(m.mint)}
                target="_blank"
                rel="noreferrer"
                className="pj-dim w-20 shrink-0 text-right hover:text-pj-green"
              >
                [pump]
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-pj-faint p-3">
        <div className="pj-dim mb-2 text-[11px]">grade this epoch</div>
        {hot.length === 0 ? (
          <div className="pj-dim text-xs">no grade yet</div>
        ) : (
          <div className="space-y-1 text-xs">
            {hot.map(({ sector, g }) => (
              <div key={sector} className="flex items-center gap-2">
                <span className="w-6">{pad(sector)}</span>
                <span className="flex-1 text-pj-green">{'█'.repeat(Math.min(g, 12))}</span>
                <span className="pj-dim tabular-nums">{g}</span>
              </div>
            ))}
          </div>
        )}
        <p className="pj-dim mt-3 text-[10px] leading-relaxed">
          highest grade strikes. ties go to whichever sector reached the count first.
        </p>
      </div>
    </div>
  )
}
