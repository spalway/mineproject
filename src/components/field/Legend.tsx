const CELL = 84

/**
 * A key, not field data. These cells are illustrative and are marked as such —
 * seeding fake claims into the live grid would leave a visitor no way to tell
 * a real holder from a decoration.
 */
const EXAMPLES = [
  {
    caption: 'open',
    note: 'click to claim it',
    sector: '07',
    grade: '2',
    line1: 'open',
    line2: 'claim',
    tone: 'border-pj-faint',
    gradeTone: 'text-pj-green font-bold',
    idTone: 'text-pj-grid',
    line1Tone: 'text-pj-grid',
    line2Tone: 'text-pj-faint',
  },
  {
    caption: 'closed',
    note: 'held by someone else',
    sector: '18',
    grade: '1',
    line1: 'closed',
    line2: '7fQ..k9x',
    tone: 'border-pj-red/70 bg-pj-red/10',
    gradeTone: 'text-pj-red font-bold',
    idTone: 'text-pj-red/70',
    line1Tone: 'text-pj-red font-bold',
    line2Tone: 'text-pj-red/80',
  },
  {
    caption: 'yours',
    note: 'you hold this one',
    sector: '33',
    grade: '3',
    line1: 'closed',
    line2: 'you',
    tone: 'border-pj-red bg-pj-red/25',
    gradeTone: 'text-pj-red font-bold',
    idTone: 'text-pj-red/70',
    line1Tone: 'text-pj-red font-bold',
    line2Tone: 'text-pj-red/80',
  },
]

export function Legend() {
  return (
    <div className="flex w-full flex-col items-center gap-3 border-t border-pj-faint pt-6">
      <div className="pj-label pj-dim text-[11px] tracking-widest">
        legend — illustrative cells, not live field data
      </div>

      <div className="flex flex-wrap items-start justify-center gap-6">
        {EXAMPLES.map((e) => (
          <div key={e.caption} className="flex flex-col items-center gap-2">
            <div
              className={`flex flex-col justify-between border p-1 text-left ${e.tone}`}
              style={{ width: CELL, height: CELL }}
            >
              <div className="flex w-full items-start justify-between leading-none">
                <span className={`text-[10px] ${e.idTone}`}>{e.sector}</span>
                <span className={`text-[19px] leading-none ${e.gradeTone}`}>{e.grade}</span>
              </div>
              <div className="w-full space-y-0.5 leading-none">
                <div className={`text-[11px] ${e.line1Tone}`}>{e.line1}</div>
                <div className={`text-[10px] ${e.line2Tone}`}>{e.line2}</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-[11px] font-bold">{e.caption}</div>
              <div className="pj-dim text-[10px]">{e.note}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="pj-dim max-w-xl text-center text-[10px] leading-relaxed">
        the number top-right is that sector&apos;s grade this round — how many real
        pump.fun launches landed in it. one claim per wallet. claiming costs
        nothing but a signature.
      </p>
    </div>
  )
}
