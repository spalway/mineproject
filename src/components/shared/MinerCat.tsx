import cat from '@/lib/cat.json'

/**
 * A cat in a miner's helmet. The art lives in cat.json so the site and the
 * generated brand assets share one source.
 *
 * Lines are ragged, so the block is left-aligned and centred as a whole.
 * Centring each line individually would shear the drawing apart.
 */
export function MinerCat() {
  return (
    <div className="flex justify-center">
      <pre
        aria-label="a cat wearing a miner's helmet"
        className="select-none text-left text-[12px] leading-[1.15] text-pj-green sm:text-[14px]"
      >
        {cat.art.join('\n')}
      </pre>
    </div>
  )
}
