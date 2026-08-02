const BANNER = [
  '██████ ██  ██ ██   ██ ██████     ██ ██████ ██████ ██  ██',
  '██  ██ ██  ██ ███ ███ ██  ██     ██ ██  ██ ██     ██ ██ ',
  '██████ ██  ██ ██ █ ██ ██████     ██ ██████ ██     ████  ',
  '██     ██  ██ ██   ██ ██     ██  ██ ██  ██ ██     ██ ██ ',
  '██      ████  ██   ██ ██      █████ ██  ██ ██████ ██  ██',
].join('\n')

export function Banner() {
  return (
    <>
      <pre
        aria-label="PUMPJACK"
        className="hidden overflow-x-auto text-[7px] leading-[1.1] text-pj-green sm:block md:text-[9px] lg:text-[11px]"
      >
        {BANNER}
      </pre>
      <h1 className="text-2xl tracking-[0.4em] sm:hidden">PUMPJACK</h1>
    </>
  )
}
