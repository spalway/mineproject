import cat from '@/lib/cat.json'

/**
 * A cat in a miner's helmet, ears out either side. The art lives in
 * cat.json so the site and the generated brand assets share one source.
 */
export function MinerCat() {
  return (
    <pre
      aria-label="a cat wearing a miner's helmet"
      className="select-none text-center text-[11px] leading-[1.15] text-pj-dim sm:text-[13px]"
    >
      {cat.art.join('\n')}
    </pre>
  )
}
