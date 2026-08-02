const GRID = 15
const HALF = 1 // stroke is 2*HALF+1 pixels thick

/**
 * The X mark rasterised onto a 15x15 pixel grid.
 *
 * Generated from the two diagonals rather than hand-typed, so the strokes are
 * exactly symmetric and the flat-cut ends fall where they should — that
 * bluntness is what separates the logo from a plain letter x.
 */
function cells(): [number, number][] {
  const out: [number, number][] = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const onDown = Math.abs(x - y) <= HALF
      const onUp = Math.abs(x - (GRID - 1 - y)) <= HALF
      if (onDown || onUp) out.push([x, y])
    }
  }
  return out
}

const CELLS = cells()

export function PixelX({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${GRID} ${GRID}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="shrink-0"
    >
      {CELLS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  )
}
