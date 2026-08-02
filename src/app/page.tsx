'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Screen } from '@/components/shared/Screen'
import { Stat } from '@/components/shared/Stat'
import { Grid } from '@/components/field/Grid'
import { RoundClock } from '@/components/field/RoundClock'
import { ClaimBar, useWalletInfo } from '@/components/field/ClaimBar'
import { Legend } from '@/components/field/Legend'
import { MinerCat } from '@/components/shared/MinerCat'
import { useClaim } from '@/hooks/useClaim'
import { sol } from '@/lib/format'

export default function PoolPage() {
  const [selected, setSelected] = useState<number | null>(null)
  const { info, reload } = useWalletInfo()

  return (
    <Screen>
      {(state, { resync, lastStrike, landed }) => {
        const dark = !state.connected
        const claimedCount = state.spots.length

        return (
          <PoolBody
            state={state}
            dark={dark}
            claimedCount={claimedCount}
            selected={selected}
            setSelected={setSelected}
            info={info}
            reload={reload}
            resync={resync}
            lastStrike={lastStrike}
            landed={landed}
          />
        )
      }}
    </Screen>
  )
}

type BodyProps = {
  state: import('@/hooks/useStream').State
  dark: boolean
  claimedCount: number
  selected: number | null
  setSelected: (n: number | null) => void
  info: ReturnType<typeof useWalletInfo>['info']
  reload: () => void
  resync: () => void
  lastStrike: number | null
  landed: Record<number, number>
}

function PoolBody({
  state,
  dark,
  claimedCount,
  selected,
  setSelected,
  info,
  reload,
  resync,
  lastStrike,
  landed,
}: BodyProps) {
  const { claim, release, busy, connected } = useClaim(() => {
    reload()
    resync()
  })

  /**
   * Clicking an open sector claims it outright when the wallet qualifies.
   * Anything that blocks the claim is surfaced as a toast rather than
   * silently doing nothing, so a click always produces an answer.
   */
  function onSectorClick(sector: number) {
    const cell = state.sectors[sector]
    if (!cell) return

    if (cell.claimed) {
      toast.info(`sector ${String(sector).padStart(2, '0')} is closed`)
      return
    }

    setSelected(sector)

    if (!connected) return toast.error('connect a wallet to claim')
    if (!state.config.tokenMint) {
      return toast.error('token mint not configured yet, claiming is closed')
    }
    if (info?.spot) {
      return toast.error(
        `you already hold sector ${String(info.spot.sector).padStart(2, '0')} — one spot per wallet`,
      )
    }
    if (info && !info.eligible) {
      return toast.error(
        `hold ${state.config.minTokens.toLocaleString()} tokens to claim · you hold ${Math.floor(info.tokens).toLocaleString()}`,
      )
    }
    if (busy) return

    void claim(sector)
  }

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <p className="max-w-2xl text-center text-xs leading-relaxed text-pj-dim">
        {state.config.sectorCount} sectors, one per wallet. hold{' '}
        <span className="font-bold text-pj-green">
          {state.config.minTokens.toLocaleString()}
        </span>{' '}
        tokens and click an open sector to claim it — a signature, not a
        transaction. every {state.config.roundMs / 60_000} minutes the board is
        ranked and{' '}
        <span className="font-bold text-pj-green">{state.config.feeShareBps / 100}%</span>{' '}
        of new creator fees is split across it.
      </p>

      <MinerCat />

      <div className="flex flex-wrap items-end justify-center gap-x-10 gap-y-4">
        <Stat label="claimed" value={`${claimedCount}/64`} />
        <Stat label="pot" value={sol(state.carried, 4)} />
        <Stat label="owed" value={sol(state.owed, 4)} vein />
        <Stat label="paid" value={sol(state.paid, 4)} />
        {state.round && (
          <RoundClock endsAt={state.round.endsAt} roundMs={state.config.roundMs} />
        )}
      </div>

      {dark && (
        <div className="border border-pj-amber/50 px-3 py-2 text-center text-[11px] text-pj-amber">
          field dark. the launch feed is disconnected, so this round voids: no sector
          strikes and the pot rolls forward whole. depth still accrues.
        </div>
      )}

      <div className="max-w-full overflow-x-auto">
        <Grid
          gridSize={state.config.gridSize}
          sectors={state.sectors}
          selected={selected}
          onSelect={onSectorClick}
          strikeSector={lastStrike}
          landed={landed}
          dark={dark}
        />
      </div>

      <ClaimBar
        sector={selected}
        minTokens={state.config.minTokens}
        tokenMint={state.config.tokenMint}
        info={info}
        busy={busy}
        connected={connected}
        onClaim={(s) => void claim(s)}
        onRelease={(id) => void release(id)}
      />

      <Legend />
    </div>
  )
}
