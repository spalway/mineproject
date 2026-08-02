'use client'

import { Nav } from '@/components/nav/Nav'
import { useStream, type State } from '@/hooks/useStream'

/**
 * Shared shell for every page: nav, stream connection, live state.
 *
 * There is no loading screen. Children render immediately against a skeleton
 * of the real page and fill in once data arrives — `loaded` tells them which
 * they are looking at, so a figure we have not read yet shows as a dash rather
 * than as a zero.
 */
export function Screen({
  title,
  blurb,
  children,
}: {
  title?: string
  blurb?: string
  children: (
    state: State,
    api: {
      resync: () => void
      live: boolean
      loaded: boolean
      lastStrike: number | null
      landed: Record<number, number>
    },
  ) => React.ReactNode
}) {
  const { state, loaded, live, resync, lastStrike, landed } = useStream()

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
        {title && (
          <header className="border-b border-pj-faint pb-3">
            <h1 className="text-lg font-bold tracking-[0.25em]">{title}</h1>
            {blurb && <p className="pj-dim mt-2 max-w-2xl text-xs leading-relaxed">{blurb}</p>}
          </header>
        )}
        {children(state, { resync, live, loaded, lastStrike, landed })}
      </main>
    </>
  )
}
