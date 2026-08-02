'use client'

import { useEffect, useState } from 'react'
import { clock } from '@/lib/format'

/**
 * Counts down locally from the epoch's own start time rather than waiting on
 * server pings, so the clock stays smooth even if the stream stutters.
 */
export function EpochClock({ endsAt, epochMs }: { endsAt: number; epochMs: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const remaining = Math.max(0, endsAt - now)
  const filled = Math.round(((epochMs - remaining) / epochMs) * 24)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-3xl leading-none tabular-nums">{clock(remaining)}</div>
      <div className="pj-dim text-xs">
        [{'█'.repeat(filled)}
        {'░'.repeat(Math.max(0, 24 - filled))}]
      </div>
    </div>
  )
}
