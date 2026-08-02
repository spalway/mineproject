const CAT = [
  '     _________     ',
  '    /   (o)   \\    ',
  '   /___________\\   ',
  ' /\\             /\\ ',
  '/  \\___________/  \\',
  '|  ( )       ( )  |',
  '|                 |',
  '|      \\_Y_/      |',
  ' \\  \\__/   \\__/  / ',
  '  \\_____________/  ',
]

/**
 * Mascot. Every row is exactly 19 columns so the shape holds in any monospace
 * face — if you edit it, keep the widths equal or the helmet drifts.
 */
export function MinerCat() {
  return (
    <pre
      aria-label="a cat wearing a miner's helmet"
      className="select-none text-center text-[11px] leading-[1.15] text-pj-dim sm:text-[13px]"
    >
      {CAT.join('\n')}
    </pre>
  )
}
