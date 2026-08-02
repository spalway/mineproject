'use client'

import { Screen } from '@/components/shared/Screen'
import { RigTable } from '@/components/depth/RigTable'

export default function DepthPage() {
  return (
    <Screen
      title="depth"
      blurb="a rig persists until you pull it. every epoch it burns 1% of its balance into the pot and gains one depth. depth multiplies your share weight up to 3x. striking does not reset it, pulling out does."
    >
      {(state) => (
        <RigTable
          depthCap={state.config.depthCap}
          depthK={state.config.depthK}
          epochMs={state.config.epochMs}
        />
      )}
    </Screen>
  )
}
