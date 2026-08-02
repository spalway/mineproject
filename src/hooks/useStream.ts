'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CONFIG } from '@/lib/config'

export type StreamEvent =
  | {
      type: 'mint'
      mint: string
      sector: number
      symbol: string | null
      name: string | null
      at: number
    }
  | { type: 'migration'; mint: string; sector: number; at: number }
  | { type: 'grade'; grades: number[] }
  | { type: 'tick'; roundId: number; startedAt: number; endsAt: number }
  | {
      type: 'strike'
      roundId: number
      sector: number | null
      pot: number
      migrationMint: string | null
    }
  | { type: 'void'; roundId: number; uptimeRatio: number }
  | { type: 'rift'; components: number[][] }
  | { type: 'claim'; wallet: string; sector: number }
  | { type: 'release'; wallet: string; sector: number }

export type MintRow = {
  mint: string
  sector: number
  symbol: string | null
  name: string | null
  received_at: number
  counted: number
}

export type Spot = {
  id: number
  wallet: string
  sector: number
  depth: number
  tokens: number
}

export type SectorStat = {
  sector: number
  grade: number
  claimed: boolean
  wallet: string | null
  depth: number
  weight: number
  poolShare: number
}

export type RoundRow = {
  id: number
  started_at: number
  ended_at: number | null
  status: string
  strike_sector: number | null
  pot_lamports: number
  carried_lamports: number
  fee_accrued_lamports: number
  treasury_lamports: number
  mint_count: number
  uptime_ratio: number
}

export type State = {
  sectors: SectorStat[]
  round: { id: number; startedAt: number; endsAt: number } | null
  grades: number[]
  occupied: number[]
  rifts: number[][]
  spots: Spot[]
  carried: number
  owed: number
  paid: number
  leaderboard: { wallet: string; lamports: number; rounds: number }[]
  recentMints: MintRow[]
  recentMigrations: { mint: string; sector: number; received_at: number }[]
  rounds: RoundRow[]
  treasury: { address: string; lastSeen: number | null }
  config: {
    gridSize: number
    sectorCount: number
    roundMs: number
    minTokens: number
    feeShareBps: number
    strikeBps: number
    riftBps: number
    poolBps: number
    depthCap: number
    depthK: number
    tokenMint: string
  }
  connected: boolean
}

/**
 * The page shape before any data has arrived: an empty board and no round.
 *
 * Built from CONFIG, which is a pure module with no server dependencies, so
 * the skeleton can never disagree with the real thing. Money figures are not
 * rendered until `loaded` — a zero here would be a number we have not read.
 */
function skeleton(): State {
  return {
    sectors: Array.from({ length: CONFIG.SECTOR_COUNT }, (_, sector) => ({
      sector,
      grade: 0,
      claimed: false,
      wallet: null,
      depth: 0,
      weight: 0,
      poolShare: 0,
    })),
    round: null,
    grades: new Array(CONFIG.SECTOR_COUNT).fill(0),
    occupied: [],
    rifts: [],
    spots: [],
    carried: 0,
    owed: 0,
    paid: 0,
    leaderboard: [],
    recentMints: [],
    recentMigrations: [],
    rounds: [],
    treasury: { address: '', lastSeen: null },
    config: {
      gridSize: CONFIG.GRID_SIZE,
      sectorCount: CONFIG.SECTOR_COUNT,
      roundMs: CONFIG.ROUND_MS,
      minTokens: CONFIG.MIN_TOKEN_BALANCE,
      feeShareBps: CONFIG.FEE_SHARE_BPS,
      strikeBps: CONFIG.STRIKE_BPS,
      riftBps: CONFIG.RIFT_BPS,
      poolBps: CONFIG.POOL_BPS,
      depthCap: CONFIG.DEPTH_CAP,
      depthK: CONFIG.DEPTH_K,
      tokenMint: '',
    },
    connected: true,
  }
}

/**
 * Live field state. Applies stream events immediately for responsiveness, and
 * resyncs from /api/state on every round boundary so nothing can drift.
 *
 * Starts from a skeleton rather than null so the page renders its real layout
 * straight away and fills in, instead of showing a loading screen.
 */
export function useStream() {
  const [state, setState] = useState<State>(skeleton)
  const [loaded, setLoaded] = useState(false)
  const [lastStrike, setLastStrike] = useState<number | null>(null)
  const [landed, setLanded] = useState<Record<number, number>>({})
  const [live, setLive] = useState(false)
  const strikeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resync = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' })
      if (res.ok) {
        setState(await res.json())
        setLoaded(true)
      }
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

        case 'rift':
          setState((prev) => (prev ? { ...prev, rifts: e.components } : prev))
          break

        case 'strike':
          setLastStrike(e.sector)
          if (strikeTimer.current) clearTimeout(strikeTimer.current)
          strikeTimer.current = setTimeout(() => setLastStrike(null), 4_000)
          void resync()
          break

        case 'tick':
        case 'void':
        case 'claim':
        case 'release':
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

  return { state, loaded, lastStrike, landed, live, resync }
}
