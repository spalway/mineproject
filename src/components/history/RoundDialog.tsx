'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { pad, shortKey, sol } from '@/lib/format'
import type { RoundRow } from '@/hooks/useStream'

type Detail = {
  round: RoundRow
  board: { id: number; wallet: string; sector: number }[]
  wallets: {
    wallet: string
    sector: number | null
    lamports: number
    legs: Record<string, number>
    rank: number
    share: number
  }[]
  distributed: number
}

const CELL = 26
const GRID = 8

export function RoundDialog({
  roundId,
  onClose,
}: {
  roundId: number | null
  onClose: () => void
}) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (roundId === null) return setDetail(null)

    let cancelled = false
    setLoading(true)
    void fetch(`/api/rounds/${roundId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [roundId])

  const claimedBy = new Map(detail?.board.map((b) => [b.sector, b.wallet]) ?? [])
  const paidWallets = new Set(detail?.wallets.map((w) => w.wallet) ?? [])
  const strike = detail?.round.strike_sector ?? null

  return (
    <Dialog open={roundId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border border-pj-faint bg-pj-bg text-pj-green sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="tracking-widest">
            round {roundId ?? ''}
            {detail?.round.status === 'void' && (
              <span className="ml-2 text-pj-amber">dark</span>
            )}
          </DialogTitle>
          <DialogDescription className="pj-dim">
            {loading
              ? 'loading'
              : detail
                ? `${detail.board.length} spots on the board · ${sol(detail.distributed, 5)} sol distributed`
                : 'could not load this round'}
          </DialogDescription>
        </DialogHeader>

        {detail && (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div
                className="grid gap-[2px]"
                style={{ gridTemplateColumns: `repeat(${GRID}, ${CELL}px)` }}
              >
                {Array.from({ length: GRID * GRID }, (_, sector) => {
                  const holder = claimedBy.get(sector)
                  const struck = strike === sector
                  const earned = holder && paidWallets.has(holder)

                  return (
                    <div
                      key={sector}
                      title={
                        holder
                          ? `sector ${pad(sector)} · ${shortKey(holder)}`
                          : `sector ${pad(sector)} · open`
                      }
                      className={[
                        'flex items-center justify-center border text-[9px]',
                        struck
                          ? 'border-pj-red bg-pj-red/40 font-bold text-pj-red'
                          : holder
                            ? earned
                              ? 'border-pj-green/70 bg-pj-green/20 text-pj-green'
                              : 'border-pj-red/50 bg-pj-red/10 text-pj-red/80'
                            : 'border-pj-faint text-pj-grid',
                      ].join(' ')}
                      style={{ height: CELL }}
                    >
                      {pad(sector)}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pj-dim flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px]">
              <span className="text-pj-red">struck</span>
              <span className="text-pj-green">claimed and earned</span>
              <span className="text-pj-red/80">claimed, earned nothing</span>
              <span>open</span>
            </div>

            <div className="border border-pj-faint">
              <div className="pj-label pj-dim grid grid-cols-[2.5rem_1fr_3.5rem_1fr_4rem] gap-2 border-b border-pj-faint px-3 py-1 text-[10px]">
                <span>rank</span>
                <span>wallet</span>
                <span>sector</span>
                <span className="text-right">received</span>
                <span className="text-right">share</span>
              </div>

              {detail.wallets.length === 0 ? (
                <div className="pj-dim px-3 py-6 text-center text-xs">
                  nothing was distributed this round
                </div>
              ) : (
                detail.wallets.map((w) => (
                  <div
                    key={w.wallet}
                    className="grid grid-cols-[2.5rem_1fr_3.5rem_1fr_4rem] items-center gap-2 border-b border-pj-faint/40 px-3 py-1 text-[11px]"
                  >
                    <span className={w.rank <= 3 ? 'font-bold text-pj-green' : 'pj-dim'}>
                      #{w.rank}
                    </span>
                    <span className="truncate">{shortKey(w.wallet, 5)}</span>
                    <span className="pj-dim">{w.sector === null ? '-' : pad(w.sector)}</span>
                    <span className="text-right tabular-nums">{sol(w.lamports, 5)}</span>
                    <span className="text-right tabular-nums text-pj-green">
                      {(w.share * 100).toFixed(1)}%
                    </span>
                  </div>
                ))
              )}
            </div>

            <p className="pj-dim text-[10px] leading-relaxed">
              share is of what actually went out this round. anything carried
              forward never reached a wallet, so it is excluded rather than
              counted against the split.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
