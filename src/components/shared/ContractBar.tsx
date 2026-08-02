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

const money = (v: number | null) =>
  v === null
    ? '--'
    : v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(2)}m`
      : v >= 1_000
        ? `$${(v / 1_000).toFixed(1)}k`
        : `$${v.toFixed(2)}`

const price = (v: number | null) =>
  v === null ? '--' : v < 0.01 ? `$${v.toPrecision(3)}` : `$${v.toFixed(4)}`

const count = (v: number | null) => (v === null ? '--' : v.toLocaleString())

/**
 * Contract address and headline token figures, under the mascot.
 *
 * Until a mint is configured this renders the same frame with dashes rather
 * than hiding — the field is meant to read as "not live yet", not as missing.
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
  const s = info?.stats ?? null

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="pj-label pj-dim text-[10px] tracking-[0.3em]">contract</div>

      {mint ? (
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
      ) : (
        <div className="text-[13px] text-pj-grid">not live yet</div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[11px]">
        <Metric label="price" value={price(s?.price ?? null)} />
        <Metric label="mcap" value={money(s?.mcap ?? null)} />
        <Metric label="liquidity" value={money(s?.liquidity ?? null)} />
        <Metric label="24h vol" value={money(s?.volume24h ?? null)} />
        <Metric label="holders" value={count(s?.holders ?? null)} />
      </div>

      {mint && (
        <a
          href={solscanUrl(mint)}
          target="_blank"
          rel="noreferrer"
          className="pj-dim text-[10px] hover:text-pj-green"
        >
          view on solscan
        </a>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="pj-dim">{label}</span>
      <span className={value === '--' ? 'text-pj-grid' : 'font-bold text-pj-green'}>
        {value}
      </span>
    </span>
  )
}
