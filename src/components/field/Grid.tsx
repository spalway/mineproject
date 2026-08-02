'use client'

import { pad, sol } from '@/lib/format'
import type { SectorStat } from '@/hooks/useStream'

const CELL = 86
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
 * The field. Each cell carries its own readout: grade this epoch, SOL staked
 * (what it costs to be here) and yield (SOL back per SOL staked if it strikes,
 * which falls as the sector fills). Adjacent occupied cells are joined by a
 * fracture bar drawn in the gap between them — that is a rift.
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
  const occupied = new Set(sectors.filter((s) => s.staked > 0).map((s) => s.sector))
  const at = (r: number, c: number) => r * gridSize + c
  const now = Date.now()

  const children: React.ReactNode[] = []

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const idx = at(r, c)
      const s = sectors[idx]
      if (!s) continue

      const isOccupied = s.staked > 0
      const isStrike = strikeSector === idx
      const isSelected = selected === idx
      const justLanded = landed[idx] !== undefined && now - landed[idx] < 700

      children.push(
        <button
          key={idx}
          onClick={() => onSelect(idx)}
          className={[
            'flex flex-col justify-between border p-1 text-left transition-colors',
            dark
              ? 'border-pj-faint text-pj-faint'
              : isOccupied
                ? 'border-pj-green/70 bg-pj-green/10'
                : s.grade > 0
                  ? 'border-pj-faint bg-pj-green/[0.04]'
                  : 'border-pj-faint',
            isSelected ? 'outline outline-1 outline-pj-green' : '',
            isStrike ? 'pj-strike' : '',
            justLanded ? 'pj-land' : '',
            'hover:border-pj-green',
          ].join(' ')}
          style={{
            gridRow: 1 + 2 * r,
            gridColumn: 1 + 2 * c,
            width: CELL,
            height: CELL,
          }}
        >
          <div className="flex w-full items-start justify-between leading-none">
            <span className="text-[13px] text-pj-grid">{pad(idx)}</span>
            <span
              className={
                s.grade > 0
                  ? 'text-[22px] leading-none text-pj-green'
                  : 'text-[22px] leading-none text-pj-grid'
              }
            >
              {dark ? '-' : s.grade}
            </span>
          </div>

          <div className="w-full space-y-0.5 leading-none">
            <div className={isOccupied ? 'text-[15px] text-pj-green' : 'text-[15px] text-pj-grid'}>
              {isOccupied ? sol(s.staked, 2) : '0.00'}
            </div>
            <div className="text-[13px] text-pj-dim">
              {s.yieldX === null ? '-' : `x${s.yieldX.toFixed(1)}`}
            </div>
          </div>
        </button>,
      )

      // Fracture bars: adjacent occupied sectors are rifted together.
      if (c < gridSize - 1 && isOccupied && occupied.has(at(r, c + 1))) {
        children.push(
          <span
            key={`h-${idx}`}
            className="self-center bg-pj-green/60"
            style={{ gridRow: 1 + 2 * r, gridColumn: 2 + 2 * c, height: 2, width: GAP }}
          />,
        )
      }
      if (r < gridSize - 1 && isOccupied && occupied.has(at(r + 1, c))) {
        children.push(
          <span
            key={`v-${idx}`}
            className="justify-self-center bg-pj-green/60"
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
