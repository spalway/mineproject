'use client'

import { useState } from 'react'
import { Screen } from '@/components/shared/Screen'
import { Stat } from '@/components/shared/Stat'
import { Grid } from '@/components/field/Grid'
import { EpochClock } from '@/components/field/EpochClock'
import { DeployBar } from '@/components/field/DeployBar'
import { sol } from '@/lib/format'

export default function FieldPage() {
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <Screen>
      {(state, { resync, lastStrike, landed }) => {
        const deployed = state.rigs.reduce((sum, r) => sum + r.balance, 0)
        const dark = !state.connected

        return (
          <div className="flex flex-col items-center gap-6 py-2">
            <p className="max-w-xl text-center text-[15px] leading-relaxed text-pj-dim">
              every pump.fun token belongs to one of 64 sectors, decided by its own
              mint address. deploy into a sector and hold. the sector graded
              highest each epoch strikes.
            </p>

            <div className="flex flex-wrap items-end justify-center gap-x-10 gap-y-4">
              <Stat label="deployed" value={`${sol(deployed)}`} />
              <Stat label="pot" value={sol(state.pot, 4)} />
              <Stat label="vein" value={sol(state.vein)} vein />
              <Stat label="rigs" value={String(state.rigs.length)} />
              {state.epoch && (
                <EpochClock endsAt={state.epoch.endsAt} epochMs={state.config.epochMs} />
              )}
            </div>

            {dark && (
              <div className="border border-pj-amber/50 px-3 py-2 text-center text-[11px] text-pj-amber">
                field dark. the launch feed is disconnected, so this epoch voids:
                no draw charged, no sector strikes, depth still accrues.
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

            <div className="pj-dim flex flex-wrap justify-center gap-x-6 gap-y-1 text-[13px]">
              <span>top-left: sector</span>
              <span>top-right: grade this epoch</span>
              <span>bottom: sol staked, then yield if it strikes</span>
            </div>

            <DeployBar
              sector={selected}
              minLamports={state.config.minDeployLamports}
              drawBps={state.config.drawBps}
              onDeployed={resync}
            />
          </div>
        )
      }}
    </Screen>
  )
}
