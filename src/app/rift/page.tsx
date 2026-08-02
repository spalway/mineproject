'use client'

import { Screen } from '@/components/shared/Screen'
import { RiftMap } from '@/components/rift/RiftMap'

export default function RiftPage() {
  return (
    <Screen
      title="rift"
      blurb="adjacent occupied sectors fracture together. when a sector strikes, every occupied sector within two hops along the fracture claims 15% of the pot. components span all wallets, so deploy beside strangers and you both gain."
    >
      {(state) => (
        <RiftMap rifts={state.rifts} rigs={state.rigs} gridSize={state.config.gridSize} />
      )}
    </Screen>
  )
}
