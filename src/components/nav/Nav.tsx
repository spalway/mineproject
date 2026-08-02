'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { PixelX } from '@/components/shared/PixelX'

const TWITTER_HANDLE = process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? 'nodeimines'
const TWITTER_URL = `https://x.com/${TWITTER_HANDLE}`

const LINKS = [
  { href: '/', label: 'pool' },
  { href: '/launches', label: 'launches' },
  { href: '/position', label: 'position' },
  { href: '/strikes', label: 'strikes' },
  { href: '/treasury', label: 'treasury' },
  { href: '/docs', label: 'docs' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-pj-faint bg-pj-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-xs">
        <Link href="/" className="text-base font-bold tracking-[0.25em] hover:text-white">
          nodei
        </Link>

        <span className="text-pj-faint">|</span>

        <nav className="flex gap-4">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname === l.href ? 'font-bold text-pj-green' : 'pj-dim hover:text-pj-green'
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <a
            href={TWITTER_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={`nodei on X, @${TWITTER_HANDLE}`}
            className="flex items-center gap-2 border border-pj-faint px-3 py-1 text-pj-green transition-colors hover:border-pj-green hover:bg-pj-green/10"
          >
            <PixelX />
            <span className="font-bold">@{TWITTER_HANDLE}</span>
          </a>
          <ConnectButton />
        </div>
      </div>
    </header>
  )
}
