'use client'

import type { RoundRow } from '@/hooks/useStream'
import { pad, shortKey, sol, solscanUrl } from '@/lib/format'

export function TreasuryPanel({
  treasury,
  carried,
  owed,
  paid,
  rounds,
  leaderboard,
  feeShareBps,
}: {
  treasury: { address: string; lastSeen: number | null }
  carried: number
  owed: number
  paid: number
  rounds: RoundRow[]
  leaderboard: { wallet: string; lamports: number; rounds: number }[]
  feeShareBps: number
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Box label="treasury" value={treasury.lastSeen === null ? '--' : sol(treasury.lastSeen)} />
        <Box label="carried pot" value={sol(carried, 4)} />
        <Box label="owed" value={sol(owed, 4)} vein />
        <Box label="paid out" value={sol(paid, 4)} />
      </div>

      <div className="border border-pj-amber/40 p-3">
        <div className="pj-label pj-vein mb-1 text-[11px]">how this works, plainly</div>
        <ul className="pj-dim space-y-1 text-[11px] leading-relaxed">
          <li>
            creator fees from pump.fun accrue to the treasury wallet.{' '}
            {feeShareBps / 100}% of whatever arrives between two rounds becomes that
            round&apos;s pot.
          </li>
          <li>
            the pot is measured as the treasury&apos;s balance change across the
            round, read from chain. a withdrawal counts as zero, never as a
            negative pot.
          </li>
          <li>
            rounds compute what each wallet is <span className="pj-vein">owed</span>.
            payouts are sent by hand, and nothing shows as paid until a signature
            is attached.
          </li>
          <li>
            the {feeShareBps / 100}% share is an operator commitment, not an
            on-chain rule. the treasury address is public so the flows can be
            checked.
          </li>
        </ul>
        {treasury.address && (
          <a
            href={solscanUrl(treasury.address)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-[11px] text-pj-green hover:underline"
          >
            treasury {shortKey(treasury.address, 6)} →
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="border border-pj-faint">
          <div className="pj-label pj-dim grid grid-cols-[3.5rem_4rem_4rem_1fr_5rem] gap-2 border-b border-pj-faint px-3 py-1 text-[11px]">
            <span>round</span>
            <span>strike</span>
            <span>mints</span>
            <span className="text-right">fees in</span>
            <span className="text-right">pot</span>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {rounds.length === 0 && (
              <div className="pj-dim px-3 py-6 text-center text-xs">
                no rounds resolved yet
              </div>
            )}

            {rounds.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[3.5rem_4rem_4rem_1fr_5rem] items-center gap-2 border-b border-pj-faint/40 px-3 py-1 text-[11px]"
              >
                <span className="pj-dim">r{r.id}</span>
                <span className={r.status === 'void' ? 'text-pj-amber' : 'text-pj-green'}>
                  {r.status === 'void'
                    ? 'dark'
                    : r.strike_sector === null
                      ? '-'
                      : pad(r.strike_sector)}
                </span>
                <span className="pj-dim tabular-nums">{r.mint_count}</span>
                <span className="text-right tabular-nums">
                  {sol(r.fee_accrued_lamports, 4)}
                </span>
                <span className="text-right tabular-nums">{sol(r.pot_lamports, 4)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-pj-faint">
          <div className="pj-label pj-dim border-b border-pj-faint px-3 py-1 text-[11px]">
            owed by wallet
          </div>
          {leaderboard.length === 0 ? (
            <div className="pj-dim px-3 py-6 text-center text-xs">nothing owed yet</div>
          ) : (
            <div className="max-h-[26rem] overflow-y-auto">
              {leaderboard.map((w) => (
                <div
                  key={w.wallet}
                  className="flex items-center justify-between border-b border-pj-faint/40 px-3 py-1 text-[11px]"
                >
                  <span className="pj-dim">{shortKey(w.wallet, 4)}</span>
                  <span className="pj-vein tabular-nums">{sol(w.lamports, 5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Box({ label, value, vein }: { label: string; value: string; vein?: boolean }) {
  return (
    <div className={`border p-3 ${vein ? 'border-pj-amber/40' : 'border-pj-faint'}`}>
      <div className="pj-label pj-dim text-[10px] tracking-widest">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${vein ? 'pj-vein' : ''}`}>
        {value}
      </div>
      <div className="pj-dim text-[10px]">sol</div>
    </div>
  )
}
