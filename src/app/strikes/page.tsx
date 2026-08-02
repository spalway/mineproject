'use client'

import { Screen } from '@/components/shared/Screen'
import { StrikeLog } from '@/components/strikes/StrikeLog'
import { RiftMap } from '@/components/rift/RiftMap'

export default function StrikesPage() {
  return (
    <Screen
      title="strikes"
      blurb="the record. every ten minutes the sector holding the most launches strikes and takes the largest share of the pot. claimed sectors that touch it share the rift leg, and every claimed spot on the board earns from the pool leg."
    >
      {(state) => (
        <div className="space-y-8">
          <StrikeLog
            rounds={state.rounds}
            strikeBps={state.config.strikeBps}
            riftBps={state.config.riftBps}
            poolBps={state.config.poolBps}
          />

          <div className="space-y-3">
            <h2 className="border-b border-pj-faint pb-2 text-sm font-bold tracking-[0.2em]">
              rifts
            </h2>
            <p className="pj-dim max-w-2xl text-xs leading-relaxed">
              claimed sectors that touch are fractured together. when one strikes,
              every claimed sector within two hops along the fracture shares the
              rift leg. components span all wallets, so claiming beside strangers
              pays both of you.
            </p>
            <RiftMap
              rifts={state.rifts}
              spots={state.spots}
              gridSize={state.config.gridSize}
              riftBps={state.config.riftBps}
            />
          </div>
        </div>
      )}
    </Screen>
  )
}
