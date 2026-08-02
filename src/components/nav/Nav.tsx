'use client'

import Link from 'next/link'
import { ConnectButton } from '@/components/wallet/ConnectButton'

const SECTIONS = ['FIELD', 'FLOW', 'DEPTH', 'RIFT', 'VEIN']

export function Nav({ live }: { live: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-pj-faint bg-pj-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-xs">
        <Link href="/" className="tracking-[0.35em] hover:text-white">
          PUMPJACK
        </Link>

        <span className="pj-dim">│</span>

        <nav className="flex gap-3">
          {SECTIONS.map((s) => (
            <a key={s} href={`#${s.toLowerCase()}`} className="pj-dim hover:text-pj-green">
              {s}
            </a>
          ))}
        </nav>

        <span className="pj-dim">│</span>

        <Link href="/about" className="pj-dim hover:text-pj-green">
          ABOUT
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <span className={live ? 'text-pj-green' : 'text-pj-amber'}>
            {live ? '● FEED LIVE' : '○ FEED DOWN'}
          </span>
          <span className="pj-dim">devnet</span>
          <ConnectButton />
        </div>
      </div>
    </header>
  )
}
