import WebSocket from 'ws'
import { sectorOf } from './sector'

const WS_URL = process.env.PUMPPORTAL_WS ?? 'wss://pumpportal.fun/api/data'

export type ParsedMint = {
  kind: 'mint'
  mint: string
  sector: number
  creator: string
  name: string | null
  symbol: string | null
  uri: string | null
  pool: string | null
}

export type ParsedMigration = {
  kind: 'migration'
  mint: string
  sector: number
}

export type ParsedEvent = ParsedMint | ParsedMigration

/**
 * Locked against real captured events in `fixtures/`, not against the docs —
 * PumpPortal publishes subscribe payloads but not response schemas.
 *
 * A real create event looks like:
 *   { signature, mint, traderPublicKey, txType: "create", name, symbol, uri,
 *     initialBuy, solAmount, marketCapSol, bondingCurveKey, pool: "pump", ... }
 *
 * Returns null for anything we don't recognise. Never infer, never backfill.
 */
export function parseEvent(raw: unknown): ParsedEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>

  // Subscription acknowledgements: { message: "Successfully subscribed..." }
  if (typeof e.message === 'string') return null

  const mint = typeof e.mint === 'string' ? e.mint : null
  if (!mint) return null

  let sector: number
  try {
    sector = sectorOf(mint)
  } catch {
    return null
  }

  const txType = typeof e.txType === 'string' ? e.txType : null

  if (txType === 'migrate') {
    return { kind: 'migration', mint, sector }
  }

  if (txType === 'create') {
    return {
      kind: 'mint',
      mint,
      sector,
      creator: typeof e.traderPublicKey === 'string' ? e.traderPublicKey : '',
      name: typeof e.name === 'string' ? e.name : null,
      symbol: typeof e.symbol === 'string' ? e.symbol : null,
      uri: typeof e.uri === 'string' ? e.uri : null,
      pool: typeof e.pool === 'string' ? e.pool : null,
    }
  }

  return null
}

type Span = { start: number; end: number }

/**
 * Holds the websocket and tracks how much of wall-clock time we were actually
 * connected. The epoch engine uses that ratio to decide whether an epoch is
 * trustworthy or must be voided — we never paper over a gap with invented data.
 */
export class Ingest {
  private ws: WebSocket | null = null
  private stopped = false
  private backoff = 1_000
  private connectedSince: number | null = null
  private spans: Span[] = []
  private onEvent: (e: ParsedEvent) => void

  constructor(onEvent: (e: ParsedEvent) => void) {
    this.onEvent = onEvent
  }

  start(): void {
    this.stopped = false
    this.connect()
  }

  stop(): void {
    this.stopped = true
    this.closeSpan()
    this.ws?.close()
    this.ws = null
  }

  private connect(): void {
    if (this.stopped) return

    const ws = new WebSocket(WS_URL)
    this.ws = ws

    ws.on('open', () => {
      this.backoff = 1_000
      this.connectedSince = Date.now()
      ws.send(JSON.stringify({ method: 'subscribeNewToken' }))
      ws.send(JSON.stringify({ method: 'subscribeMigration' }))
      console.log('[ingest] connected to', WS_URL)
    })

    ws.on('message', (buf: Buffer) => {
      let raw: unknown
      try {
        raw = JSON.parse(buf.toString())
      } catch {
        return
      }
      const parsed = parseEvent(raw)
      if (parsed) this.onEvent(parsed)
    })

    ws.on('close', () => {
      this.closeSpan()
      if (this.stopped) return
      console.warn(`[ingest] disconnected, retrying in ${this.backoff}ms`)
      setTimeout(() => this.connect(), this.backoff)
      this.backoff = Math.min(this.backoff * 2, 30_000)
    })

    ws.on('error', (err: Error) => {
      console.warn('[ingest] socket error:', err.message)
      // 'close' fires after 'error'; reconnect is handled there.
    })
  }

  private closeSpan(): void {
    if (this.connectedSince === null) return
    this.spans.push({ start: this.connectedSince, end: Date.now() })
    this.connectedSince = null
    // Keep only the last hour of history.
    const cutoff = Date.now() - 3_600_000
    this.spans = this.spans.filter((s) => s.end > cutoff)
  }

  /** Fraction of [since, until] during which the feed was connected, 0..1. */
  uptimeRatio(since: number, until: number): number {
    const window = until - since
    if (window <= 0) return 1

    const all = [...this.spans]
    if (this.connectedSince !== null) {
      all.push({ start: this.connectedSince, end: until })
    }

    let connected = 0
    for (const s of all) {
      const start = Math.max(s.start, since)
      const end = Math.min(s.end, until)
      if (end > start) connected += end - start
    }
    return Math.min(1, connected / window)
  }

  get connected(): boolean {
    return this.connectedSince !== null
  }
}
