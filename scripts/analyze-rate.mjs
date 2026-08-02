/**
 * Calibrate GRID_SIZE and EPOCH_MS against a real captured sample.
 *
 * The failure mode we're checking for: if a typical epoch's winning grade is 1,
 * the strike is decided purely by whichever sector got the first mint, and the
 * grid stops being a contest. We want a winning grade of 2+ most of the time.
 *
 *   node scripts/analyze-rate.mjs fixtures/pumpportal-rate.jsonl <captureSeconds>
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2] ?? 'fixtures/pumpportal-rate.jsonl'
const captureSeconds = Number(process.argv[3] ?? 240)

const events = readFileSync(file, 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))

const creates = events.filter((e) => e.txType === 'create')
const migrations = events.filter((e) => e.txType === 'migrate')

const perMinute = (creates.length / captureSeconds) * 60
console.log(`sample: ${creates.length} creates, ${migrations.length} migrations in ${captureSeconds}s`)
console.log(`rate:   ${perMinute.toFixed(1)} mints/min\n`)

// Monte-Carlo the strike quality for candidate configurations.
function simulate(sectorCount, epochSeconds, trials = 20_000) {
  const mintsPerEpoch = (perMinute / 60) * epochSeconds
  let degenerate = 0
  let totalMax = 0

  for (let t = 0; t < trials; t++) {
    // Poisson draw for how many mints actually arrive this epoch.
    let n = 0
    let p = Math.exp(-mintsPerEpoch)
    let cumulative = p
    const u = Math.random()
    while (u > cumulative && n < 500) {
      n++
      p *= mintsPerEpoch / n
      cumulative += p
    }

    const grades = new Array(sectorCount).fill(0)
    for (let i = 0; i < n; i++) grades[Math.floor(Math.random() * sectorCount)]++
    const max = Math.max(...grades)
    totalMax += max
    if (max <= 1) degenerate++
  }

  return {
    mintsPerEpoch: mintsPerEpoch.toFixed(1),
    avgWinningGrade: (totalMax / trials).toFixed(2),
    degeneratePct: ((degenerate / trials) * 100).toFixed(1),
  }
}

const configs = [
  [64, 60],
  [64, 120],
  [36, 60],
  [36, 120],
  [36, 180],
  [25, 60],
  [25, 120],
  [25, 180],
  [16, 120],
]

console.log('grid  epoch  mints/epoch  avg winning grade  degenerate (max<=1)')
for (const [sectors, secs] of configs) {
  const r = simulate(sectors, secs)
  const grid = Math.sqrt(sectors)
  console.log(
    `${grid}x${grid}   ${String(secs).padStart(3)}s   ${r.mintsPerEpoch.padStart(11)}  ` +
      `${r.avgWinningGrade.padStart(17)}  ${r.degeneratePct.padStart(8)}%`,
  )
}
