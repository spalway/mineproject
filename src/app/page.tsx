'use client'

import { useState } from 'react'
import { Screen } from '@/components/shared/Screen'
import { Stat } from '@/components/shared/Stat'
import { Grid } from '@/components/field/Grid'
import { RoundClock } from '@/components/field/RoundClock'
import { ClaimBar, useWalletInfo } from '@/components/field/ClaimBar'
import { sol } from '@/lib/format'

export default function FieldPage() {
  const [selected, setSelected] = useState<number | null>(null)
  const { info, reload } = useWalletInfo()

  return (
    <Screen>
      {(state, { resync, lastStrike, landed }) => {
        const dark = !state.connected
        const claimedCount = state.spots.length

        return (
          <div className="flex flex-col items-center gap-6 py-2">
            <p className="max-w-2xl text-center text-xs leading-relaxed text-pj-dim">
              every pump.fun token belongs to one of 64 sectors, decided by its own
              mint address. hold{' '}
              <span className="font-bold text-pj-green">
                {state.config.minTokens.toLocaleString()}
              </span>{' '}
              tokens and claim a sector with a signature. every ten minutes,{' '}
              <span className="font-bold text-pj-green">
                {state.config.feeShareBps / 100}%
              </span>{' '}
              of newly accrued creator fees is split across the field.
            </p>

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
                field dark. the launch feed is disconnected, so this round voids: no
                sector strikes and the pot rolls forward whole. depth still accrues.
              </div>
            )}

            <div className="max-w-full overflow-x-auto">
              <Grid
                gridSize={state.config.gridSize}
                sectors={state.sectors}
                selected={selected}
                onSelect={setSelected}
                strikeSector={lastStrike}
                landed={landed}
                dark={dark}
              />
            </div>

            <div className="pj-dim flex flex-wrap justify-center gap-x-6 gap-y-1 text-[11px]">
              <span>top-left: sector</span>
              <span>top-right: grade this round</span>
              <span>bottom: holder, pool share, depth</span>
            </div>

            <ClaimBar
              sector={selected}
              minTokens={state.config.minTokens}
              tokenMint={state.config.tokenMint}
              info={info}
              onChanged={() => {
                void reload()
                resync()
              }}
            />
          </div>
        )
      }}
    </Screen>
  )
}
