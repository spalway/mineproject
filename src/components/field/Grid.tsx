'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { pad, shortKey } from '@/lib/format'
import type { SectorStat } from '@/hooks/useStream'

const CELL = 84
const GAP = 5

type Props = {
  gridSize: number
  sectors: SectorStat[]
  selected: number | null
  onSelect: (sector: number) => void
  strikeSector: number | null
  landed: Record<number, number>
  dark: boolean
}

/**
 * The field. Open sectors are green and clickable; claimed sectors go red and
 * read "closed" with the holder's abbreviated wallet. Adjacent claimed cells
 * are joined by a fracture bar drawn in the gap — that is a rift.
 */
export function Grid({
  gridSize,
  sectors,
  selected,
  onSelect,
  strikeSector,
  landed,
  dark,
}: Props) {
  const { publicKey } = useWallet()
  const me = publicKey?.toBase58() ?? null

  const claimed = new Set(sectors.filter((s) => s.claimed).map((s) => s.sector))
  const at = (r: number, c: number) => r * gridSize + c
  const now = Date.now()

  const children: React.ReactNode[] = []

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const idx = at(r, c)
      const s = sectors[idx]
      if (!s) continue

      const mine = !!me && s.wallet === me
      const isStrike = strikeSector === idx
      const isSelected = selected === idx
      const justLanded = landed[idx] !== undefined && now - landed[idx] < 700

      children.push(
        <button
          key={idx}
          onClick={() => onSelect(idx)}
          title={
            s.claimed
              ? `sector ${pad(idx)} · closed · held by ${s.wallet} · depth ${s.depth}`
              : `sector ${pad(idx)} · open · click to claim`
          }
          className={[
            'flex flex-col justify-between border p-1 text-left transition-colors',
            dark
              ? 'border-pj-faint text-pj-faint'
              : s.claimed
                ? mine
                  ? 'border-pj-red bg-pj-red/25'
                  : 'border-pj-red/70 bg-pj-red/10'
                : s.grade > 0
                  ? 'border-pj-faint bg-pj-green/[0.04] hover:border-pj-green'
                  : 'border-pj-faint hover:border-pj-green',
            isSelected && !s.claimed ? 'outline outline-1 outline-pj-green' : '',
            isStrike ? 'pj-strike' : '',
            justLanded ? 'pj-land' : '',
            s.claimed ? 'cursor-default' : 'cursor-pointer',
          ].join(' ')}
          style={{ gridRow: 1 + 2 * r, gridColumn: 1 + 2 * c, width: CELL, height: CELL }}
        >
          <div className="flex w-full items-start justify-between leading-none">
            <span className={s.claimed ? 'text-[10px] text-pj-red/70' : 'text-[10px] text-pj-grid'}>
              {pad(idx)}
            </span>
            <span
              className={[
                'text-[19px] leading-none',
                s.grade > 0 ? 'font-bold' : '',
                s.claimed
                  ? 'text-pj-red'
                  : s.grade > 0
                    ? 'text-pj-green'
                    : 'text-pj-grid',
              ].join(' ')}
            >
              {dark ? '-' : s.grade}
            </span>
          </div>

          <div className="w-full space-y-0.5 leading-none">
            {s.claimed ? (
              <>
                <div className="text-[11px] font-bold text-pj-red">closed</div>
                <div className="truncate text-[10px] text-pj-red/80">
                  {mine ? 'you' : shortKey(s.wallet ?? '', 3)}
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] text-pj-grid">open</div>
                <div className="text-[10px] text-pj-faint">claim</div>
              </>
            )}
          </div>
        </button>,
      )

      // Fracture bars: adjacent claimed sectors are rifted together.
      if (c < gridSize - 1 && s.claimed && claimed.has(at(r, c + 1))) {
        children.push(
          <span
            key={`h-${idx}`}
            className="self-center bg-pj-red/60"
            style={{ gridRow: 1 + 2 * r, gridColumn: 2 + 2 * c, height: 2, width: GAP }}
          />,
        )
      }
      if (r < gridSize - 1 && s.claimed && claimed.has(at(r + 1, c))) {
        children.push(
          <span
            key={`v-${idx}`}
            className="justify-self-center bg-pj-red/60"
            style={{ gridRow: 2 + 2 * r, gridColumn: 1 + 2 * c, width: 2, height: GAP }}
          />,
        )
      }
    }
  }

  const tracks = Array.from({ length: gridSize }, (_, i) =>
    i === gridSize - 1 ? `${CELL}px` : `${CELL}px ${GAP}px`,
  ).join(' ')

  return (
    <div
      className="grid select-none"
      style={{ gridTemplateColumns: tracks, gridTemplateRows: tracks }}
    >
      {children}
    </div>
  )
}
