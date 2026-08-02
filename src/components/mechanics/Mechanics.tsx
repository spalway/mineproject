'use client'

import { RiftMap } from '@/components/rift/RiftMap'
import type { Spot } from '@/hooks/useStream'
import { shortKey, sol, solscanUrl } from '@/lib/format'

const STEPS = [
  {
    step: '01',
    title: 'hold',
    body: 'hold the minimum balance of the token. it is checked on chain at the start of every round, so a spot only stays yours while you still qualify.',
  },
  {
    step: '02',
    title: 'claim',
    body: 'sign a message to take one open sector. it is a signature, not a transaction: nothing moves, and you pay no network fee. one sector per wallet.',
  },
  {
    step: '03',
    title: 'wait',
    body: 'every ten minutes the round closes and the board is ranked. one sector comes out on top, and the sectors touching it rank next.',
  },
  {
    step: '04',
    title: 'earn',
    body: 'the pot is split across the top sector, the sectors around it, and every claimed spot on the board. your share is recorded in the ledger.',
  },
]

export function Mechanics({
  spots,
  rifts,
  gridSize,
  strikeBps,
  riftBps,
  poolBps,
  feeShareBps,
  minTokens,
  roundMs,
  depthCap,
  carried,
  owed,
  paid,
  treasury,
}: {
  spots: Spot[]
  rifts: number[][]
  gridSize: number
  strikeBps: number
  riftBps: number
  poolBps: number
  feeShareBps: number
  minTokens: number
  roundMs: number
  depthCap: number
  carried: number
  owed: number
  paid: number
  treasury: { address: string; lastSeen: number | null }
}) {
  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.step} className="border border-pj-faint p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-pj-green">{s.step}</span>
              <span className="pj-label text-xs">{s.title}</span>
            </div>
            <p className="pj-dim mt-2 text-[10px] leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border border-pj-faint p-4">
          <h2 className="pj-label mb-3 text-xs tracking-widest">how a pot splits</h2>
          <div className="space-y-1.5 text-xs">
            <Split label="the top sector" pct={strikeBps / 100} />
            <Split label="sectors touching it" pct={riftBps / 100} />
            <Split label="every claimed spot" pct={poolBps / 100} />
          </div>
          <p className="pj-dim mt-3 text-[10px] leading-relaxed">
            that third leg is what makes this a pool rather than a lottery:
            holding a spot always earns something, whether or not you sit on the
            winner. a leg with nobody eligible is carried into the next round
            instead of vanishing, so an empty board banks the pot.
          </p>
        </div>

        <div className="border border-pj-faint p-4">
          <h2 className="pj-label mb-3 text-xs tracking-widest">the numbers</h2>
          <div className="space-y-1.5 text-xs">
            <Row label="round length" value={`${roundMs / 60_000} minutes`} />
            <Row label="minimum to claim" value={minTokens.toLocaleString()} />
            <Row label="sectors" value={`${gridSize * gridSize}`} />
            <Row label="fee share to the pool" value={`${feeShareBps / 100}%`} />
            <Row label="depth cap" value={`${depthCap} rounds, 3x weight`} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="border-b border-pj-faint pb-2 text-sm font-bold tracking-[0.2em]">
          neighbours
        </h2>
        <p className="pj-dim max-w-2xl text-xs leading-relaxed">
          claimed sectors that touch are linked. when one of them comes out on
          top, every claimed sector within two steps of it shares the second leg.
          links are counted across every wallet, not per wallet, so claiming
          beside strangers pays both of you. that is the collaborative part.
        </p>
        <RiftMap rifts={rifts} spots={spots} gridSize={gridSize} riftBps={riftBps} />
      </div>

      <div className="space-y-3">
        <h2 className="border-b border-pj-faint pb-2 text-sm font-bold tracking-[0.2em]">
          the pool
        </h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Box
            label="treasury"
            value={treasury.lastSeen === null ? '--' : sol(treasury.lastSeen)}
          />
          <Box label="in the pot" value={sol(carried, 4)} />
          <Box label="owed" value={sol(owed, 4)} vein />
          <Box label="paid out" value={sol(paid, 4)} />
        </div>

        <p className="pj-dim max-w-2xl text-[10px] leading-relaxed">
          the pot is funded by creator fees arriving in the treasury.{' '}
          {feeShareBps / 100}% of whatever lands between two rounds becomes that
          round&apos;s pot, measured from the wallet&apos;s balance change and read
          from chain at each close. a withdrawal counts as zero, never as a
          negative pot. the ledger moves a row from{' '}
          <span className="pj-vein">owed</span> to{' '}
          <span className="text-pj-green">paid</span> once the treasury sends it
          and its signature is attached.
        </p>

        {treasury.address && (
          <a
            href={solscanUrl(treasury.address)}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-[11px] text-pj-green hover:underline"
          >
            treasury {shortKey(treasury.address, 6)} →
          </a>
        )}
      </div>
    </div>
  )
}

function Split({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0">{label}</span>
      <span className="flex-1 text-pj-green">{'#'.repeat(Math.round(pct / 2))}</span>
      <span className="tabular-nums font-bold">{pct}%</span>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="pj-dim">{label}</span>
      <span className="tabular-nums">{value}</span>
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
