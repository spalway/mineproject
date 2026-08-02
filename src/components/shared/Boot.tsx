'use client'

import { useEffect, useState } from 'react'

const LINES = [
  'PUMPJACK v1 :: collaborative extraction field',
  'partition   :: pubkey[0] % 64 — permissionless, unforgeable',
  'feed        :: pumpportal · subscribeNewToken + subscribeMigration',
]

/**
 * Types out a status banner. Purely decorative — it renders over an already
 * connected stream and never gates or delays real data.
 */
export function Boot() {
  const [shown, setShown] = useState(0)
  const [chars, setChars] = useState(0)

  useEffect(() => {
    if (shown >= LINES.length) return
    const line = LINES[shown]

    if (chars < line.length) {
      const t = setTimeout(() => setChars((c) => c + 2), 12)
      return () => clearTimeout(t)
    }

    const t = setTimeout(() => {
      setShown((s) => s + 1)
      setChars(0)
    }, 120)
    return () => clearTimeout(t)
  }, [shown, chars])

  return (
    <div className="pj-dim min-h-[3.5rem] space-y-0.5 text-[10px] leading-relaxed sm:text-[11px]">
      {LINES.slice(0, shown).map((l) => (
        <div key={l}>› {l}</div>
      ))}
      {shown < LINES.length && (
        <div>
          › {LINES[shown].slice(0, chars)}
          <span className="pj-cursor" />
        </div>
      )}
    </div>
  )
}
