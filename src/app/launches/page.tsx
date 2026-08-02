'use client'

import { Screen } from '@/components/shared/Screen'
import { FlowTicker } from '@/components/flow/FlowTicker'
import { Pipeline } from '@/components/flow/Pipeline'

export default function LaunchesPage() {
  return (
    <Screen
      title="launches"
      blurb="the raw material. every token minted on pump.fun lands in exactly one sector of the field, decided by its own address, and raises that sector's grade for the round. this is that stream as it arrives."
    >
      {(state) => (
        <div className="space-y-8">
          <Pipeline
            tokenMint={state.config.tokenMint}
            connected={state.connected}
            roundMs={state.config.roundMs}
          />

          <div className="space-y-3">
            <h2 className="border-b border-pj-faint pb-2 text-sm font-bold tracking-[0.2em]">
              live feed
            </h2>
            <p className="pj-dim max-w-2xl text-xs leading-relaxed">
              every row links back to the real token. pick any one and check that
              the sector we assigned matches{' '}
              <span className="text-pj-green">pubkey[0] % 64</span> — or hit{' '}
              <span className="text-pj-green">/api/verify/&lt;mint&gt;</span> and
              compare.
            </p>
            <FlowTicker mints={state.recentMints} grades={state.grades} />
          </div>
        </div>
      )}
    </Screen>
  )
}
