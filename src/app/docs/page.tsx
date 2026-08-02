'use client'

import Link from 'next/link'
import { Nav } from '@/components/nav/Nav'

const SECTIONS = [
  {
    id: 'overview',
    title: 'overview',
    body: (
      <>
        <p>
          nodei is a collaborative mining pool laid out as a 64 sector field.
          hold the token, claim one sector with a signature, and every ten
          minutes the board is ranked and a share of creator fees is split
          across it.
        </p>
        <p className="mt-3">
          nothing you do here moves your funds. claiming is a signed message,
          your wallet stays untouched, and the pool never takes custody of
          anything you hold.
        </p>
      </>
    ),
  },
  {
    id: 'claim',
    title: 'claiming a sector',
    body: (
      <>
        <p>
          hold the minimum balance and any open sector is yours for the taking.
          the wallet prompt states plainly that the signature moves no funds, and
          you pay no network fee for it.
        </p>
        <p className="mt-3">
          the server verifies the signature, then reads your token balance
          straight from chain — it never takes the client&apos;s word for what a
          wallet holds. one live sector per wallet. balances are re-checked at
          the start of every round, so selling below the minimum opens your
          sector back up for someone else.
        </p>
      </>
    ),
  },
  {
    id: 'ranking',
    title: 'how the board is ranked',
    body: (
      <>
        <p>
          each of the 64 sectors is bound to a slice of the solana token address
          space, and every new token minted on pump.fun falls into exactly one of
          them, decided by its own address:
        </p>
        <pre className="my-3 border border-pj-faint p-3 text-pj-green">
          sector = mintPubkey.toBytes()[0] % 64
        </pre>
        <p>
          nobody assigns that, including us. the assignment is permanent and
          anyone can recompute it — pass any token address to{' '}
          <span className="text-pj-green">/api/verify/&lt;mint&gt;</span> and check
          our answer against your own.
        </p>
        <p className="mt-3">
          a sector&apos;s activity for the round is the count of tokens that landed
          in it, capped at one per creator per sector so a single wallet cannot
          manufacture a win cheaply. the busiest sector comes out on top. ties go
          to whichever sector reached the count first, which makes a contested
          round a race rather than a coin flip.
        </p>
      </>
    ),
  },
  {
    id: 'split',
    title: 'how a pot splits',
    body: (
      <>
        <p>
          <span className="text-pj-green">50%</span> to whoever holds the top
          sector, <span className="text-pj-green">20%</span> across the claimed
          sectors touching it, and <span className="text-pj-green">30%</span> to
          every claimed sector on the board.
        </p>
        <p className="mt-3">
          that third leg is what makes this a pool rather than a lottery —
          holding a sector always earns something. any leg with nobody eligible
          is carried into the next round rather than vanishing, so an empty board
          banks the whole pot instead of burning it.
        </p>
      </>
    ),
  },
  {
    id: 'neighbours',
    title: 'neighbours',
    body: (
      <>
        <p>
          claimed sectors that touch are linked, and links are counted across
          every wallet rather than per wallet. you benefit from strangers
          claiming beside you.
        </p>
        <p className="mt-3">
          when a sector comes out on top, claimed sectors within two steps of it
          along that chain share the second leg. the two step cap is deliberate:
          without it a board-spanning chain would pay everyone and position would
          stop meaning anything. the mechanics page shows the live map.
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
          every round your sector survives adds one depth, and depth multiplies
          your share weight up to 3x over 36 rounds, roughly six hours.
        </p>
        <p className="mt-3">
          depth costs nothing to accrue. there is no stake, no burn and nothing
          at risk — the only way to lose it is to release your sector or fall
          below the minimum balance.
        </p>
      </>
    ),
  },
  {
    id: 'fees',
    title: 'where the pot comes from',
    body: (
      <>
        <p>
          creator fees accrue to the treasury wallet, and{' '}
          <span className="text-pj-green">70%</span> of whatever arrives between
          two rounds becomes that round&apos;s pot.
        </p>
        <p className="mt-3">
          accrual is measured as the treasury&apos;s balance change across the
          round, read from chain at each close. a withdrawal counts as zero
          rather than as a negative pot. the treasury address is published on the
          mechanics page so the flows can be followed independently.
        </p>
      </>
    ),
  },
  {
    id: 'settlement',
    title: 'settlement',
    body: (
      <>
        <p>
          each round records what every wallet earned in a public ledger. your
          position page shows your running total broken down by leg, and the
          history page shows the same figures for every round the pool has run.
        </p>
        <p className="mt-3">
          the treasury sends distributions against that ledger. a row moves from{' '}
          <span className="pj-vein">owed</span> to{' '}
          <span className="text-pj-green">paid</span> once its transaction
          signature is attached, so every settlement can be followed on chain.
          amounts already earned stay on the ledger whether or not you keep your
          sector.
        </p>
      </>
    ),
  },
  {
    id: 'limits',
    title: 'limits',
    body: (
      <>
        <p>the things worth knowing before you take a sector.</p>
        <ul className="mt-3 space-y-2">
          <li>
            the 70% share is an operator commitment, not an on-chain rule. there
            is no contract enforcing it.
          </li>
          <li>
            this app holds <span className="text-pj-green">no private key</span>.
            claiming is signature-only, so nothing here can move your funds.
          </li>
          <li>
            the ranking is contestable. anyone can push a sector by paying to
            launch tokens into it. that is a feature and it costs real sol.
          </li>
          <li>
            ordering uses our own receipt time, not chain time, so tie breaks
            depend on when we observed activity.
          </li>
          <li>
            the activity feed has no uptime guarantee. if it drops for more than
            a fifth of a round, that round closes dark: nothing is distributed
            and the pot rolls forward whole. we never estimate a result to fill a
            gap.
          </li>
        </ul>
      </>
    ),
  },
]

export default function Docs() {
  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="flex flex-col gap-10 lg:flex-row">
          <article className="min-w-0 flex-1 space-y-10">
            <header>
              <h1 className="text-lg font-bold tracking-[0.25em]">docs</h1>
              <p className="pj-dim mt-2 max-w-2xl text-xs leading-relaxed">
                the full reference. nine short sections, one idea each.
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
                back to the pool
              </Link>
            </footer>
          </article>

          <nav className="lg:sticky lg:top-16 lg:h-fit lg:w-44">
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
