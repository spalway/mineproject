'use client'

import { useState } from 'react'
import { useStream } from '@/hooks/useStream'
import { Nav } from '@/components/nav/Nav'
import { Banner } from '@/components/shared/Banner'
import { Boot } from '@/components/shared/Boot'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { Grid } from '@/components/field/Grid'
import { EpochClock } from '@/components/field/EpochClock'
import { DeployPanel } from '@/components/field/DeployPanel'
import { FlowTicker } from '@/components/flow/FlowTicker'
import { RigTable } from '@/components/depth/RigTable'
import { RiftMap } from '@/components/rift/RiftMap'
import { VeinPanel } from '@/components/vein/VeinPanel'
import { sol } from '@/lib/format'

export default function Page() {
  const { state, lastStrike, landed, live, resync } = useStream()
  const [selected, setSelected] = useState<number | null>(null)

  if (!state) {
    return (
      <>
        <Nav live={false} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16">
          <div className="pj-dim text-sm">
            establishing link<span className="pj-cursor" />
          </div>
        </main>
      </>
    )
  }

  const { config } = state
  const deployed = state.rigs.reduce((sum, r) => sum + r.balance, 0)
  const dark = !state.connected

  return (
    <>
      <Nav live={live && state.connected} />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-16 px-4 py-8">
        {/* ------------------------------------------------------ FIELD */}
        <section id="field" className="scroll-mt-16 space-y-6">
          <Banner />
          <Boot />

          <p className="max-w-2xl text-sm leading-relaxed">
            The pump.fun launch stream is a mineral field. Every token that has
            ever launched belongs to exactly one of 64 sectors, decided by its
            own mint address —{' '}
            <span className="text-white">pubkey[0] % 64</span>. Nobody assigns
            it. Nobody, including us, can move a token between sectors. Deploy
            SOL into a sector and hold it while real launches rain across the
            grid. The sector graded highest each epoch strikes.
          </p>

          <div className="flex flex-wrap items-end justify-between gap-6 border-y border-pj-faint py-4">
            <Stat label="DEPLOYED" value={`${sol(deployed)} SOL`} />
            <Stat label="VEIN" value={sol(state.vein)} vein />
            <Stat label="RIGS" value={String(state.rigs.length)} />
            {state.epoch && (
              <EpochClock endsAt={state.epoch.endsAt} epochMs={config.epochMs} />
            )}
          </div>

          {dark && (
            <div className="border border-pj-amber/50 px-3 py-2 text-xs text-pj-amber">
              FIELD DARK — the launch feed is disconnected. This epoch will void:
              no draw is charged, no sector strikes, depth still accrues. We do
              not invent mints to cover a gap.
            </div>
          )}

          <div className="flex flex-col items-start gap-10 lg:flex-row lg:justify-between">
            <Grid
              gridSize={config.gridSize}
              grades={state.grades}
              occupied={state.occupied}
              selected={selected}
              onSelect={setSelected}
              strikeSector={lastStrike}
              landed={landed}
              dark={dark}
            />
            <DeployPanel
              sector={selected}
              minLamports={config.minDeployLamports}
              drawBps={config.drawBps}
              onDeployed={resync}
            />
          </div>
        </section>

        {/* ------------------------------------------------------- FLOW */}
        <section className="space-y-4">
          <SectionHeader
            id="flow"
            title="FLOW"
            blurb="The live pump.fun firehose, bucketed as it arrives. Each launch lands in the sector its own address dictates and raises that sector's grade for the epoch. Every row links back to the real token — check any of them."
          />
          <FlowTicker mints={state.recentMints} grades={state.grades} />
        </section>

        {/* ------------------------------------------------------ DEPTH */}
        <section className="space-y-4">
          <SectionHeader
            id="depth"
            title="DEPTH"
            blurb="A rig persists until you pull it. Every epoch it burns 1% of its balance into the pot and gains one depth. Depth multiplies your share weight up to 3×. Striking does not reset it — pulling out does."
          />
          <RigTable
            depthCap={config.depthCap}
            depthK={config.depthK}
            epochMs={config.epochMs}
          />
        </section>

        {/* ------------------------------------------------------- RIFT */}
        <section className="space-y-4">
          <SectionHeader
            id="rift"
            title="RIFT"
            blurb="Adjacent occupied sectors fracture together. When a sector strikes, every occupied sector within two hops along the fracture claims 15% of the pot. Components span all wallets — deploy beside strangers and you both gain."
          />
          <RiftMap rifts={state.rifts} rigs={state.rigs} gridSize={config.gridSize} />
        </section>

        {/* ------------------------------------------------------- VEIN */}
        <section className="space-y-4">
          <SectionHeader
            id="vein"
            title="VEIN"
            blurb="Six percent of every pot, plus the entire distributable pot whenever the striking sector holds no rigs. It only cracks when a real bonding-curve graduation lands inside the striking sector — and never on demand."
          />
          <VeinPanel
            vein={state.vein}
            epochs={state.epochs}
            migrations={state.recentMigrations}
          />
        </section>
      </main>

      <footer className="border-t border-pj-faint px-4 py-6">
        <div className="pj-dim mx-auto max-w-6xl space-y-1 text-[10px] leading-relaxed">
          <div>
            › devnet. Payouts are signed by a server-held treasury key —
            custodial by design at this stage.
          </div>
          <div>
            › Sector grade is contestable: anyone can push a sector by paying to
            launch tokens into it, visibly, in FLOW.
          </div>
          <div>› Arrival order uses our ingest receipt time, not chain time.</div>
          <div>
            › The feed is PumpPortal&apos;s free tier and carries no SLA.
            Outages void the epoch rather than being papered over.
          </div>
        </div>
      </footer>
    </>
  )
}

function Stat({ label, value, vein }: { label: string; value: string; vein?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={vein ? 'pj-vein text-2xl tabular-nums' : 'text-2xl tabular-nums'}>
        {value}
      </span>
      <span className="pj-dim text-[11px] tracking-widest">{label}</span>
    </div>
  )
}
