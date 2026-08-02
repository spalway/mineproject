'use client'

import { Screen } from '@/components/shared/Screen'
import { FlowTicker } from '@/components/flow/FlowTicker'

export default function FlowPage() {
  return (
    <Screen
      title="flow"
      blurb="the live pump.fun firehose, bucketed as it arrives. each launch lands in the sector its own address dictates and raises that sector's grade for the epoch. every row links back to the real token, so check any of them."
    >
      {(state) => <FlowTicker mints={state.recentMints} grades={state.grades} />}
    </Screen>
  )
}
