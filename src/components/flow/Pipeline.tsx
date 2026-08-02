'use client'

type Stage = {
  step: string
  title: string
  body: string
}

const STAGES: Stage[] = [
  {
    step: '01',
    title: 'ingest',
    body: 'a websocket holds open to the pump.fun firehose and receives every token creation and every bonding-curve graduation as it happens. malformed events are dropped, never inferred.',
  },
  {
    step: '02',
    title: 'partition',
    body: 'each mint is assigned to one of 64 sectors by its own address: pubkey[0] % 64. the token decides, not us. the assignment is permanent and anyone can recompute it.',
  },
  {
    step: '03',
    title: 'grade',
    body: "a sector's grade is the count of launches that landed in it this round, capped at one per creator per sector so a single wallet cannot manufacture a win cheaply.",
  },
  {
    step: '04',
    title: 'resolve',
    body: 'every ten minutes the highest grade strikes. ties go to whichever sector reached the count first, which makes a contested round a race rather than a coin flip.',
  },
  {
    step: '05',
    title: 'distribute',
    body: "the round's pot is measured from the treasury's balance change, split across the striking sector, the rift around it, and every claimed spot, then written to the ledger.",
  },
]

export function Pipeline({
  tokenMint,
  connected,
  roundMs,
}: {
  tokenMint: string
  connected: boolean
  roundMs: number
}) {
  const status = [
    { label: 'launch feed', live: connected, note: connected ? 'connected' : 'disconnected' },
    { label: 'sector partition', live: true, note: 'deterministic, verifiable' },
    { label: 'round engine', live: true, note: `${roundMs / 60_000} minute rounds` },
    { label: 'signature claims', live: true, note: 'no transaction, no fee' },
    {
      label: 'token gate',
      live: !!tokenMint,
      note: tokenMint ? 'enforced on chain' : 'awaiting mint address',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((s) => (
          <div key={s.step} className="border border-pj-faint p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-pj-green">{s.step}</span>
              <span className="pj-label text-xs">{s.title}</span>
            </div>
            <p className="pj-dim mt-2 text-[10px] leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="border border-pj-faint p-3">
          <div className="pj-label pj-dim mb-2 text-[11px]">status</div>
          <div className="space-y-1 text-xs">
            {status.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className={s.live ? '' : 'pj-dim'}>{s.label}</span>
                <span className={s.live ? 'text-pj-green' : 'text-pj-amber'}>
                  {s.note}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-pj-faint p-3">
          <div className="pj-label pj-dim mb-2 text-[11px]">next</div>
          <ul className="pj-dim space-y-1.5 text-[10px] leading-relaxed">
            <li>
              a second feed source so a pumpportal outage stops voiding rounds.
              today an outage longer than a fifth of a round marks it dark.
            </li>
            <li>
              usd pricing on pot and ledger figures. wired but dormant until an
              api key is set, and it shows nothing rather than a guess.
            </li>
            <li>
              postgres persistence so history survives a restart and the ledger
              is queryable directly.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
