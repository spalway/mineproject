'use client'

import { useEffect, useState } from 'react'
import { clock } from '@/lib/format'

const BARS = 16

/**
 * Counts down locally from the round's own end time rather than waiting on
 * server pings, so the clock stays smooth even if the stream stutters.
 */
export function RoundClock({ endsAt, roundMs }: { endsAt: number; roundMs: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const remaining = Math.max(0, endsAt - now)
  const filled = Math.round(((roundMs - remaining) / roundMs) * BARS)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-2xl font-bold leading-none tabular-nums">{clock(remaining)}</div>
      <div className="pj-dim text-[11px]">
        [{'#'.repeat(Math.max(0, filled))}
        {'-'.repeat(Math.max(0, BARS - filled))}]
      </div>
      <div className="pj-label pj-dim text-[10px] tracking-widest">next round</div>
    </div>
  )
}
