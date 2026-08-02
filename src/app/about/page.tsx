'use client'

import Link from 'next/link'
import { Nav } from '@/components/nav/Nav'

const SECTIONS = [
  {
    id: 'partition',
    title: 'PARTITION',
    body: (
      <>
        <p>
          Every pump.fun token belongs to exactly one of 64 sectors, and the
          token decides which one — not us.
        </p>
        <pre className="my-3 border border-pj-faint p-3 text-pj-green">
          sector = mintPubkey.toBytes()[0] % 64
        </pre>
        <p>
          This works because pump.fun&apos;s vanity grind targets the{' '}
          <span className="text-pj-green">pump</span> suffix, leaving the leading
          bytes effectively uniform. The partition is permanent, permissionless,
          and checkable by anyone in one line. No operator can move a token
          between sectors. Hit{' '}
          <span className="text-pj-green">/api/verify/&lt;mint&gt;</span> with any
          token address and check ours against yours.
        </p>
      </>
    ),
  },
  {
    id: 'grade',
    title: 'GRADE',
    body: (
      <>
        <p>
          Each epoch runs 120 seconds. Every launch that lands in a sector raises
          its grade by one, capped at one mint per creator per sector so a single
          wallet cannot spam a cell. The highest grade strikes.
        </p>
        <p className="mt-3">
          Ties go to whichever sector <em>reached</em> the winning count first,
          which makes contested epochs a footrace rather than a coin flip. Epoch
          length is not a vibe: at 60 seconds and the measured launch rate, 29% of
          epochs would have finished with a winning grade of 1 and the strike
          would collapse to whoever caught the first mint. At 120 seconds that
          falls to 1.4%.
        </p>
      </>
    ),
  },
  {
    id: 'rig',
    title: 'RIG',
    body: (
      <>
        <p>
          A deploy creates a rig, and the rig persists until you pull it. Each
          epoch it burns 1% of its balance into the pot — it consumes fuel
          whether or not it wins — and gains one depth.
        </p>
        <p className="mt-3">
          Depth multiplies your share weight up to 3× over 60 epochs. At a 1%
          draw a rig halves in about 69 epochs, so weight peaks just as holding
          starts getting expensive. Striking does not reset depth. Pulling out
          does, all the way to zero.
        </p>
      </>
    ),
  },
  {
    id: 'rift',
    title: 'RIFT',
    body: (
      <>
        <p>
          Occupied sectors that touch are fractured together, and components are
          counted across every wallet rather than per-wallet. You benefit from
          strangers deploying beside you.
        </p>
        <p className="mt-3">
          When a sector strikes, occupied sectors within two hops along the
          fracture claim 15% of the pot while strikers take 75%. The two-hop cap
          is deliberate — without it a board-spanning component would pay
          everyone and locality would stop meaning anything.
        </p>
      </>
    ),
  },
  {
    id: 'vein',
    title: 'VEIN',
    body: (
      <>
        <p>
          The vein takes 6% of every pot. It also swallows the entire
          distributable pot whenever the striking sector holds no rigs, which
          early on is most epochs — that is what grows it into something worth
          chasing.
        </p>
        <p className="mt-3">
          It pays out only when a real bonding-curve graduation lands inside the
          striking sector, split among that sector&apos;s rigs by weight. Rift
          claimants never draw from it. Nothing about it can be triggered on
          demand.
        </p>
      </>
    ),
  },
  {
    id: 'honest',
    title: 'WHAT THIS IS NOT',
    body: (
      <>
        <ul className="space-y-2">
          <li>
            › Running on <span className="text-pj-green">devnet</span>. Payouts
            are signed by a server-held treasury key, so custody is a trust
            assumption, not a trustless guarantee.
          </li>
          <li>
            › Grade is contestable. Anyone can push a sector by paying to launch
            tokens into it. That is a feature, it costs real SOL, and you can
            watch it happen live in FLOW.
          </li>
          <li>
            › Arrival order uses our ingest receipt time, not chain time. Tie
            breaks depend on when we observed a launch.
          </li>
          <li>
            › The launch feed is PumpPortal&apos;s free tier with no SLA. If it
            drops for more than 20% of an epoch, that epoch voids: no draw
            charged, no strike, depth still accrues. We do not invent mints to
            cover a gap.
          </li>
        </ul>
      </>
    ),
  },
]

export default function About() {
  return (
    <>
      <Nav live />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="flex flex-col gap-10 lg:flex-row">
          <article className="min-w-0 flex-1 space-y-12">
            <header>
              <h1 className="text-2xl tracking-[0.3em]">ABOUT</h1>
              <p className="pj-dim mt-2 max-w-2xl text-sm leading-relaxed">
                PUMPJACK turns the pump.fun launch stream into a field you can
                take a position in. Six short sections, one idea each.
              </p>
            </header>

            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-16 space-y-2">
                <h2 className="border-b border-pj-faint pb-2 text-lg tracking-[0.25em]">
                  {s.title}
                </h2>
                <div className="max-w-2xl text-sm leading-relaxed text-pj-dim [&_span]:text-pj-green">
                  {s.body}
                </div>
              </section>
            ))}

            <footer className="border-t border-pj-faint pt-4">
              <Link href="/" className="text-sm hover:text-white">
                ‹ back to the field
              </Link>
            </footer>
          </article>

          <nav className="lg:sticky lg:top-16 lg:h-fit lg:w-40">
            <div className="pj-dim mb-2 text-[11px]">CONTENTS</div>
            <ul className="space-y-1 text-xs">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="pj-dim hover:text-pj-green">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
    </>
  )
}
