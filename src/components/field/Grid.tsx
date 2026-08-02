'use client'

import { pad } from '@/lib/format'

/** Ascending grade density. The field is drawn in characters, not shapes. */
const GLYPHS = ['·', '░', '▒', '▓', '█'] as const

function glyphFor(grade: number): string {
  return GLYPHS[Math.min(grade, GLYPHS.length - 1)]
}

type Props = {
  gridSize: number
  grades: number[]
  occupied: number[]
  selected: number | null
  onSelect: (sector: number) => void
  strikeSector: number | null
  landed: Record<number, number>
  dark: boolean
}

export function Grid({
  gridSize,
  grades,
  occupied,
  selected,
  onSelect,
  strikeSector,
  landed,
  dark,
}: Props) {
  const occupiedSet = new Set(occupied)
  const at = (r: number, c: number) => r * gridSize + c
  const now = Date.now()

  const children: React.ReactNode[] = []

  // Column headers
  for (let c = 0; c < gridSize; c++) {
    children.push(
      <span
        key={`ch-${c}`}
        className="pj-dim text-center text-[10px] leading-none"
        style={{ gridRow: 1, gridColumn: 2 + 2 * c }}
      >
        {pad(c)}
      </span>,
    )
  }

  for (let r = 0; r < gridSize; r++) {
    // Row header
    children.push(
      <span
        key={`rh-${r}`}
        className="pj-dim pr-1 text-right text-[10px] leading-none"
        style={{ gridRow: 2 + 2 * r, gridColumn: 1 }}
      >
        {pad(r)}
      </span>,
    )

    for (let c = 0; c < gridSize; c++) {
      const sector = at(r, c)
      const grade = grades[sector] ?? 0
      const isOccupied = occupiedSet.has(sector)
      const isStrike = strikeSector === sector
      const isSelected = selected === sector
      const justLanded = landed[sector] !== undefined && now - landed[sector] < 700

      const tone = dark
        ? 'text-pj-faint'
        : isOccupied
          ? 'text-pj-green'
          : grade > 0
            ? 'text-pj-mid'
            : 'text-pj-grid'

      children.push(
        <button
          key={`c-${sector}`}
          onClick={() => onSelect(sector)}
          title={`sector ${pad(sector)} · grade ${grade}${isOccupied ? ' · occupied' : ''}`}
          className={[
            'flex h-7 w-7 items-center justify-center text-base leading-none transition-colors',
            tone,
            isOccupied ? 'bg-pj-green/10' : '',
            isSelected ? 'outline outline-1 outline-pj-green' : '',
            isStrike ? 'pj-strike' : '',
            justLanded ? 'pj-land' : '',
            'hover:bg-pj-green/20',
          ].join(' ')}
          style={{ gridRow: 2 + 2 * r, gridColumn: 2 + 2 * c }}
        >
          {dark ? '·' : glyphFor(grade)}
        </button>,
      )

      // Rift links: two adjacent occupied sectors are, by definition, fractured
      // together. Drawn as real box characters so the tunnel is literal text.
      if (c < gridSize - 1 && isOccupied && occupiedSet.has(at(r, c + 1))) {
        children.push(
          <span
            key={`h-${sector}`}
            className="flex items-center justify-center text-base leading-none text-pj-mid"
            style={{ gridRow: 2 + 2 * r, gridColumn: 3 + 2 * c }}
          >
            ═
          </span>,
        )
      }
      if (r < gridSize - 1 && isOccupied && occupiedSet.has(at(r + 1, c))) {
        children.push(
          <span
            key={`v-${sector}`}
            className="flex items-center justify-center text-xs leading-none text-pj-mid"
            style={{ gridRow: 3 + 2 * r, gridColumn: 2 + 2 * c }}
          >
            ║
          </span>,
        )
      }
    }
  }

  return (
    <div
      className="inline-grid select-none"
      style={{
        // Link columns must hold their width even when empty, otherwise cells
        // drift out of alignment with the axis labels.
        gridTemplateColumns: `2.5ch ${Array.from({ length: gridSize }, (_, i) =>
          i === gridSize - 1 ? '1.75rem' : '1.75rem 0.85rem',
        ).join(' ')}`,
        gridTemplateRows: `1rem ${Array.from({ length: gridSize }, (_, i) =>
          i === gridSize - 1 ? '1.75rem' : '1.75rem 0.6rem',
        ).join(' ')}`,
      }}
    >
      {children}
    </div>
  )
}
