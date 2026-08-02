'use client'

import { Screen } from '@/components/shared/Screen'
import { SpotPanel } from '@/components/depth/SpotPanel'

export default function DepthPage() {
  return (
    <Screen
      title="depth"
      blurb="a spot is held until you release it or drop below the minimum balance. every round it survives adds one depth, and depth multiplies your share weight up to 3x. it costs nothing to accrue, so the only way to lose it is to churn."
    >
      {(state) => (
        <SpotPanel
          depthCap={state.config.depthCap}
          depthK={state.config.depthK}
          roundMs={state.config.roundMs}
        />
      )}
    </Screen>
  )
}
