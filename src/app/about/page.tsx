'use client'

import Link from 'next/link'
import { Nav } from '@/components/nav/Nav'

const SECTIONS = [
  {
    id: 'partition',
    title: 'partition',
    body: (
      <>
        <p>
          every pump.fun token belongs to exactly one of 64 sectors, and the
          token decides which one, not us.
        </p>
        <pre className="my-3 border border-pj-faint p-3 text-pj-green">
          sector = mintPubkey.toBytes()[0] % 64
        </pre>
        <p>
          this works because pump.fun&apos;s vanity grind targets the{' '}
          <span className="text-pj-green">pump</span> suffix, leaving the leading
          bytes effectively uniform. the partition is permanent, permissionless,
          and checkable by anyone in one line. no operator can move a token
          between sectors. hit{' '}
          <span className="text-pj-green">/api/verify/&lt;mint&gt;</span> with any
          token address and check ours against yours.
        </p>
      </>
    ),
  },
  {
    id: 'claim',
    title: 'claim',
    body: (
      <>
        <p>
          hold 10,000 nodei and you can claim one open sector. claiming is a
          signed message, not a transaction: no lamports move, you pay no network
          fee, and the wallet prompt says so in plain text.
        </p>
        <p className="mt-3">
          the server verifies the signature, then reads your token balance
          straight from chain. it never takes the client&apos;s word for what a
          wallet holds. one live spot per wallet, and every spot is re-checked at
          the start of each round: sell below the minimum and the sector opens
          back up.
        </p>
      </>
    ),
  },
  {
    id: 'rounds',
    title: 'rounds',
    body: (
      <>
        <p>
          a round runs for ten minutes. every launch that lands in a sector
          raises its grade by one, capped at one mint per creator per sector so a
          single wallet cannot spam a cell. the highest grade strikes, and ties
          go to whichever sector reached the winning count first.
        </p>
        <p className="mt-3">
          the round pot is split three ways:{' '}
          <span className="text-pj-green">50%</span> to the striking sector,{' '}
          <span className="text-pj-green">20%</span> across the rift around it,
          and <span className="text-pj-green">30%</span> to every claimed spot on
          the board. that last leg is what makes this a pool rather than a
          lottery — holding a spot always earns something.
        </p>
        <p className="mt-3">
          any leg with no eligible recipients is carried into the next round
          rather than vanishing. an empty board banks the whole pot.
        </p>
      </>
    ),
  },
  {
    id: 'fees',
    title: 'fees',
    body: (
      <>
        <p>
          the pot comes from pump.fun creator fees. those accrue to the treasury
          wallet, and <span className="text-pj-green">70%</span> of whatever
          arrives between two rounds becomes that round&apos;s pot.
        </p>
        <p className="mt-3">
          accrual is measured as the treasury&apos;s balance change across the
          round, read from chain at each close. a withdrawal counts as zero
          rather than as a negative pot. the treasury address is published on the
          vein page so the flows can be checked independently.
        </p>
      </>
    ),
  },
  {
    id: 'depth',
    title: 'depth',
    body: (
      <>
        <p>
          every round your spot survives adds one depth. depth multiplies your
          share weight up to 3x over 36 rounds, roughly six hours.
        </p>
        <p className="mt-3">
          depth costs nothing to accrue. there is no stake, no burn, and nothing
          at risk — the only way to lose it is to release your spot or fall below
          the minimum balance. anything already owed stays owed either way.
        </p>
      </>
    ),
  },
  {
    id: 'rift',
    title: 'rift',
    body: (
      <>
        <p>
          claimed sectors that touch are fractured together, and components are
          counted across every wallet rather than per-wallet. you benefit from
          strangers claiming beside you.
        </p>
        <p className="mt-3">
          when a sector strikes, claimed sectors within two hops along the
          fracture share the rift leg. the two-hop cap is deliberate. without it
          a board-spanning component would pay everyone and locality would stop
          meaning anything.
        </p>
      </>
    ),
  },
  {
    id: 'honest',
    title: 'what this is not',
    body: (
      <ul className="space-y-2">
        <li>
          <span className="pj-vein">payouts are manual.</span> rounds compute what
          each wallet is owed and write it to a public ledger. settlement is sent
          by hand, and a row only reads paid once a real signature is attached.
          nothing on this site is an automatic or guaranteed transfer.
        </li>
        <li>
          the 70% share is an operator commitment, not an on-chain rule. there is
          no contract enforcing it.
        </li>
        <li>
          this app holds <span className="text-pj-green">no private key</span>.
          claiming is signature-only, so nothing here can move your funds — the
          worst a compromise of the server could do is lie about what is owed,
          and the ledger is public.
        </li>
        <li>
          grade is contestable. anyone can push a sector by paying to launch
          tokens into it. that is a feature, it costs real sol, and you can watch
          it happen live in flow.
        </li>
        <li>
          arrival order uses our ingest receipt time, not chain time. tie breaks
          depend on when we observed a launch.
        </li>
        <li>
          the launch feed is pumpportal&apos;s free tier with no sla. if it drops
          for more than 20% of a round, that round voids: no sector strikes and
          the pot rolls forward whole. we do not invent mints to cover a gap.
        </li>
      </ul>
    ),
  },
]

export default function About() {
  return (
    <>
      <Nav live />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="flex flex-col gap-10 lg:flex-row">
          <article className="min-w-0 flex-1 space-y-10">
            <header>
              <h1 className="text-lg font-bold tracking-[0.25em]">about</h1>
              <p className="pj-dim mt-2 max-w-2xl text-xs leading-relaxed">
                nodei is a collaborative mining field over the pump.fun launch
                stream. hold the token, claim a sector, earn a share of creator
                fees every ten minutes. seven short sections, one idea each.
              </p>
            </header>

            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-16 space-y-2">
                <h2 className="border-b border-pj-faint pb-2 text-sm font-bold tracking-[0.2em]">
                  {s.title}
                </h2>
                <div className="max-w-2xl text-xs leading-relaxed text-pj-dim">{s.body}</div>
              </section>
            ))}

            <footer className="border-t border-pj-faint pt-4">
              <Link href="/" className="text-xs hover:text-white">
                back to the field
              </Link>
            </footer>
          </article>

          <nav className="lg:sticky lg:top-16 lg:h-fit lg:w-40">
            <div className="pj-label pj-dim mb-2 text-[10px]">contents</div>
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
