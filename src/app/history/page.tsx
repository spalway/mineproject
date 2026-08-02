'use client'

import { Screen } from '@/components/shared/Screen'
import { RoundLog } from '@/components/history/RoundLog'

export default function HistoryPage() {
  return (
    <Screen
      title="history"
      blurb="every round the pool has run. each one closes, ranks the board, and records exactly what each wallet received. open a round to see the board as it stood and the full distribution."
    >
      {(state) => (
        <RoundLog
          rounds={state.rounds}
          carried={state.carried}
          owed={state.owed}
          paid={state.paid}
        />
      )}
    </Screen>
  )
}
