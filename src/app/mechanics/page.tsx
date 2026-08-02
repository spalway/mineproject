'use client'

import { Screen } from '@/components/shared/Screen'
import { Mechanics } from '@/components/mechanics/Mechanics'

export default function MechanicsPage() {
  return (
    <Screen
      title="mechanics"
      blurb="how it works, end to end. hold the token, take a sector, and earn a share of the pool every ten minutes based on where you sat and who sat beside you."
    >
      {(state) => (
        <Mechanics
          spots={state.spots}
          rifts={state.rifts}
          gridSize={state.config.gridSize}
          strikeBps={state.config.strikeBps}
          riftBps={state.config.riftBps}
          poolBps={state.config.poolBps}
          feeShareBps={state.config.feeShareBps}
          minTokens={state.config.minTokens}
          roundMs={state.config.roundMs}
          depthCap={state.config.depthCap}
          carried={state.carried}
          owed={state.owed}
          paid={state.paid}
          treasury={state.treasury}
        />
      )}
    </Screen>
  )
}
