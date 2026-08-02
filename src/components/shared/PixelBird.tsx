/**
 * The bird, rasterised onto a pixel grid so it sits in the same visual
 * language as the rest of the site. Inherits colour via currentColor.
 */
const PATTERN = [
  '..............##', // beak
  '............####',
  '..........#####.',
  '.........#####..',
  '.#.......#####..', // tail feathers break out to the left
  '.###....######..',
  '.#####.#######..',
  '.##############.',
  '.#############..',
  '..###########...',
  '..##########....',
  '...########.....',
  '...#######......', // belly sweeps left rather than tapering to a point
  '....#####.......',
  '....###.........',
  '.....#..........',
]

export function PixelBird({ size = 14 }: { size?: number }) {
  const cols = PATTERN[0].length
  const rows = PATTERN.length

  return (
    <svg
      width={(size * cols) / rows}
      height={size}
      viewBox={`0 0 ${cols} ${rows}`}
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
