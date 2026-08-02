import { CONFIG } from './config'

export type MintEvent = {
  mint: string
  sector: number
  creator: string
  /** ingest receipt time, not chain time — see spec §3.1 */
  receivedAt: number
}

export type MigrationEvent = { mint: string; sector: number }

export type RoundInput = {
  mints: MintEvent[]
  migrations: MigrationEvent[]
  /** fraction of the round the feed was connected, 0..1 */
  uptimeRatio: number
}

export type RoundResult = {
  status: 'resolved' | 'void'
  strikeSector: number | null
  grades: number[]
  countedMints: MintEvent[]
  migrationMint: string | null
}

/**
 * Grade is the count of mints landing in a sector, with one mint counted per
 * creator per sector per round.
 *
 * The field is deliberately contestable — anyone can push a sector by paying
 * to launch tokens into it, visibly, in FLOW. The per-creator cap only defeats
 * trivial one-wallet spam; sybils remain possible at higher cost, and we say so
 * rather than pretending otherwise.
 */
export function computeGrades(mints: MintEvent[]): {
  grades: number[]
  counted: MintEvent[]
} {
  const grades = new Array<number>(CONFIG.SECTOR_COUNT).fill(0)
  const seen = new Set<string>()
  const counted: MintEvent[] = []

  for (const m of [...mints].sort((a, b) => a.receivedAt - b.receivedAt)) {
    const key = `${m.creator}:${m.sector}`
    if (seen.has(key)) continue
    seen.add(key)
    grades[m.sector]++
    counted.push(m)
  }

  return { grades, counted }
}

/**
 * Resolve one round. Highest grade strikes; ties go to whichever sector
 * REACHED the winning count first, which makes it a footrace rather than a
 * coin flip and keeps the outcome derivable from observed order alone.
 */
export function resolveRound(input: RoundInput): RoundResult {
  const { grades, counted } = computeGrades(input.mints)

  if (input.uptimeRatio < 1 - CONFIG.VOID_THRESHOLD) {
    return {
      status: 'void',
      strikeSector: null,
      grades,
      countedMints: counted,
      migrationMint: null,
    }
  }

  const max = Math.max(0, ...grades)
  if (max === 0) {
    return {
      status: 'resolved',
      strikeSector: null,
      grades,
      countedMints: counted,
      migrationMint: null,
    }
  }

  let strikeSector: number | null = null
  let bestTime = Infinity
  const progress = new Array<number>(CONFIG.SECTOR_COUNT).fill(0)

  // `counted` is already ordered by receivedAt.
  for (const m of counted) {
    progress[m.sector]++
    if (progress[m.sector] === max && m.receivedAt < bestTime) {
      bestTime = m.receivedAt
      strikeSector = m.sector
    }
  }

  const migration = input.migrations.find((g) => g.sector === strikeSector)

  return {
    status: 'resolved',
    strikeSector,
    grades,
    countedMints: counted,
    migrationMint: migration ? migration.mint : null,
  }
}
