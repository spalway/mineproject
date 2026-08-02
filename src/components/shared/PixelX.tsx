/**
 * The X mark on a 13x13 pixel grid — bold strokes with flat cut ends, so it
 * reads as the logo rather than as a generic letter x, while staying in the
 * same visual language as the rest of the site.
 *
 * Inherits colour from surrounding text via currentColor.
 */
const PATTERN = [
  '##.........##',
  '###.......###',
  '.###.....###.',
  '..###...###..',
  '...###.###...',
  '....#####....',
  '.....###.....',
  '....#####....',
  '...###.###...',
  '..###...###..',
  '.###.....###.',
  '###.......###',
  '##.........##',
]

export function PixelX({ size = 13 }: { size?: number }) {
  const grid = PATTERN.length

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="shrink-0"
    >
      {PATTERN.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === '#' ? (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
          ) : null,
        ),
      )}
    </svg>
  )
}
