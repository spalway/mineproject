'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@/components/wallet/ConnectButton'

const LINKS = [
  { href: '/', label: 'field' },
  { href: '/flow', label: 'flow' },
  { href: '/depth', label: 'depth' },
  { href: '/rift', label: 'rift' },
  { href: '/vein', label: 'vein' },
]

export function Nav({ live }: { live: boolean }) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-pj-faint bg-pj-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-[15px]">
        <Link href="/" className="text-[20px] tracking-[0.25em] hover:text-white">
          nodei
        </Link>

        <span className="text-pj-faint">|</span>

        <nav className="flex gap-3">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? 'text-pj-green' : 'pj-dim hover:text-pj-green'}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <span className="text-pj-faint">|</span>

        <Link
          href="/about"
          className={pathname === '/about' ? 'text-pj-green' : 'pj-dim hover:text-pj-green'}
        >
          about
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <span className={live ? 'text-pj-green' : 'text-pj-amber'}>
            {live ? 'feed live' : 'feed down'}
          </span>
          <span className="pj-dim">devnet</span>
          <ConnectButton />
        </div>
      </div>
    </header>
  )
}
