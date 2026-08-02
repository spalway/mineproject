'use client'

import { Screen } from '@/components/shared/Screen'
import { RiftMap } from '@/components/rift/RiftMap'

export default function RiftPage() {
  return (
    <Screen
      title="rift"
      blurb="adjacent claimed sectors fracture together. when a sector strikes, every claimed sector within two hops along the fracture shares the rift leg. components span all wallets, so claiming beside strangers pays both of you."
    >
      {(state) => (
        <RiftMap
          rifts={state.rifts}
          spots={state.spots}
          gridSize={state.config.gridSize}
          riftBps={state.config.riftBps}
        />
      )}
    </Screen>
  )
}
