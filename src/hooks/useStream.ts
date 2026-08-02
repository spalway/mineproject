'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type StreamEvent =
  | { type: 'mint'; mint: string; sector: number; symbol: string | null; name: string | null; at: number }
  | { type: 'migration'; mint: string; sector: number; at: number }
  | { type: 'grade'; grades: number[] }
  | { type: 'tick'; epochId: number; startedAt: number; endsAt: number }
  | { type: 'strike'; epochId: number; sector: number | null; pot: number; veinPaid: number; migrationMint: string | null }
  | { type: 'void'; epochId: number; uptimeRatio: number }
  | { type: 'vein'; balance: number }
  | { type: 'rift'; components: number[][] }
  | { type: 'deploy'; wallet: string; sector: number; lamports: number }

export type MintRow = {
  mint: string
  sector: number
  symbol: string | null
  name: string | null
  received_at: number
  counted: number
}

export type Rig = {
  id: number
  wallet: string
  sector: number
  balance: number
  depth: number
}

export type EpochRow = {
  id: number
  started_at: number
  ended_at: number | null
  status: string
  strike_sector: number | null
  pot_lamports: number
  vein_paid_lamports: number
  migration_mint: string | null
  mint_count: number
  uptime_ratio: number
}

export type SectorStat = {
  sector: number
  grade: number
  /** lamports staked in this sector */
  staked: number
  rigs: number
  /** SOL back per SOL staked if this sector strikes; null when empty */
  yieldX: number | null
}

export type State = {
  sectors: SectorStat[]
  /** lamports the pot would hold if the epoch resolved right now */
  pot: number
  epoch: { id: number; startedAt: number; endsAt: number } | null
  grades: number[]
  occupied: number[]
  rifts: number[][]
  rigs: Rig[]
  vein: number
  recentMints: MintRow[]
  recentMigrations: { mint: string; sector: number; received_at: number }[]
  epochs: EpochRow[]
  config: {
    gridSize: number
    sectorCount: number
    epochMs: number
    drawBps: number
    minDeployLamports: number
    depthCap: number
    depthK: number
  }
  connected: boolean
}

/**
 * Live field state. Applies stream events immediately for responsiveness, and
 * resyncs from /api/state on every epoch boundary so nothing can drift.
 */
export function useStream() {
  const [state, setState] = useState<State | null>(null)
  const [lastStrike, setLastStrike] = useState<number | null>(null)
  const [landed, setLanded] = useState<Record<number, number>>({})
  const [live, setLive] = useState(false)
  const strikeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resync = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' })
      if (res.ok) setState(await res.json())
    } catch {
      // transient; the stream will trigger another resync shortly
    }
  }, [])

  useEffect(() => {
    void resync()

    const es = new EventSource('/api/stream')
    es.onopen = () => setLive(true)
    es.onerror = () => setLive(false)

    es.onmessage = (msg) => {
      let e: StreamEvent
      try {
        e = JSON.parse(msg.data)
      } catch {
        return
      }

      switch (e.type) {
        case 'mint':
          setLanded((prev) => ({ ...prev, [e.sector]: e.at }))
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  recentMints: [
                    {
                      mint: e.mint,
                      sector: e.sector,
                      symbol: e.symbol,
                      name: e.name,
                      received_at: e.at,
                      counted: 1,
                    },
                    ...prev.recentMints,
                  ].slice(0, 40),
                }
              : prev,
          )
          break

        case 'grade':
          setState((prev) => (prev ? { ...prev, grades: e.grades } : prev))
          break

        case 'vein':
          setState((prev) => (prev ? { ...prev, vein: e.balance } : prev))
          break

        case 'rift':
          setState((prev) => (prev ? { ...prev, rifts: e.components } : prev))
          break

        case 'strike':
          setLastStrike(e.sector)
          if (strikeTimer.current) clearTimeout(strikeTimer.current)
          strikeTimer.current = setTimeout(() => setLastStrike(null), 3_000)
          void resync()
          break

        case 'tick':
        case 'void':
        case 'deploy':
        case 'migration':
          void resync()
          break
      }
    }

    return () => {
      es.close()
      if (strikeTimer.current) clearTimeout(strikeTimer.current)
    }
  }, [resync])

  return { state, lastStrike, landed, live, resync }
}
