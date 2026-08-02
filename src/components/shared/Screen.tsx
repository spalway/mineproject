'use client'

import { Nav } from '@/components/nav/Nav'
import { useStream, type State } from '@/hooks/useStream'

/**
 * Shared shell for every page: nav, stream connection, loading state.
 * Sub-pages get live state through the render prop.
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
      lastStrike: number | null
      landed: Record<number, number>
    },
  ) => React.ReactNode
}) {
  const { state, live, resync, lastStrike, landed } = useStream()

  if (!state) {
    return (
      <>
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16">
          <div className="pj-dim text-sm">
            establishing link<span className="pj-cursor" />
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
        {title && (
          <header className="border-b border-pj-faint pb-3">
            <h1 className="text-lg tracking-[0.25em]">{title}</h1>
            {blurb && <p className="pj-dim mt-2 max-w-2xl text-xs leading-relaxed">{blurb}</p>}
          </header>
        )}
        {children(state, { resync, live, lastStrike, landed })}
      </main>
    </>
  )
}
