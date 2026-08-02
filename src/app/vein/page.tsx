'use client'

import { Screen } from '@/components/shared/Screen'
import { TreasuryPanel } from '@/components/vein/TreasuryPanel'

export default function VeinPage() {
  return (
    <Screen
      title="vein"
      blurb="where the money comes from. creator fees accrue to the treasury, a share of each round's inflow becomes that round's pot, and the ledger records what every wallet is owed. settlement is manual."
    >
      {(state) => (
        <TreasuryPanel
          treasury={state.treasury}
          carried={state.carried}
          owed={state.owed}
          paid={state.paid}
          rounds={state.rounds}
          leaderboard={state.leaderboard}
          feeShareBps={state.config.feeShareBps}
        />
      )}
    </Screen>
  )
}
