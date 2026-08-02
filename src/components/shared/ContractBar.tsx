'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { solscanUrl } from '@/lib/format'

type TokenInfo = {
  mint: string
  live: boolean
  pricesConfigured: boolean
  stats: {
    price: number | null
    mcap: number | null
    liquidity: number | null
    volume24h: number | null
    holders: number | null
  } | null
}

const money = (v: number) =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}m`
    : v >= 1_000
      ? `$${(v / 1_000).toFixed(1)}k`
      : `$${v.toFixed(2)}`

const price = (v: number) => (v < 0.01 ? `$${v.toPrecision(3)}` : `$${v.toFixed(4)}`)

const count = (v: number) => v.toLocaleString()

/**
 * Contract address and headline token figures, under the mascot.
 *
 * Renders nothing at all until there is something real to show. No label, no
 * placeholder, no dashes — an empty space is honest about an unlaunched token
 * in a way that a row of "--" is not, and it keeps the page clean until the
 * mint exists. Each metric appears only once it has an actual value.
 */
export function ContractBar() {
  const [info, setInfo] = useState<TokenInfo | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = () =>
      fetch('/api/token', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d) setInfo(d)
        })
        .catch(() => {})

    void load()
    const t = setInterval(() => void load(), 60_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const mint = info?.mint ?? ''
  if (!mint) return null

  const s = info?.stats ?? null

  const metrics: { label: string; value: string }[] = []
  if (s) {
    if (s.price !== null) metrics.push({ label: 'price', value: price(s.price) })
    if (s.mcap !== null) metrics.push({ label: 'mcap', value: money(s.mcap) })
    if (s.liquidity !== null) metrics.push({ label: 'liquidity', value: money(s.liquidity) })
    if (s.volume24h !== null) metrics.push({ label: '24h vol', value: money(s.volume24h) })
    if (s.holders !== null) metrics.push({ label: 'holders', value: count(s.holders) })
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="pj-label pj-dim text-[10px] tracking-[0.3em]">contract</div>

      <button
        onClick={() => {
          void navigator.clipboard.writeText(mint)
          toast.success('contract address copied')
        }}
        title="click to copy"
        className="max-w-full break-all px-2 text-center text-[13px] font-bold text-pj-green hover:text-white"
      >
        {mint}
      </button>

      {metrics.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[11px]">
          {metrics.map((m) => (
            <span key={m.label} className="flex items-baseline gap-1.5">
              <span className="pj-dim">{m.label}</span>
              <span className="font-bold text-pj-green">{m.value}</span>
            </span>
          ))}
        </div>
      )}

      <a
        href={solscanUrl(mint)}
        target="_blank"
        rel="noreferrer"
        className="pj-dim text-[10px] hover:text-pj-green"
      >
        view on solscan
      </a>
    </div>
  )
}
