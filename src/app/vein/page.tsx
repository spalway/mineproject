'use client'

import { Screen } from '@/components/shared/Screen'
import { VeinPanel } from '@/components/vein/VeinPanel'

export default function VeinPage() {
  return (
    <Screen
      title="vein"
      blurb="six percent of every pot, plus the entire distributable pot whenever the striking sector holds no rigs. it only cracks when a real bonding-curve graduation lands inside the striking sector, and never on demand."
    >
      {(state) => (
        <VeinPanel
          vein={state.vein}
          epochs={state.epochs}
          migrations={state.recentMigrations}
        />
      )}
    </Screen>
  )
}
