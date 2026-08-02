import { PublicKey } from '@solana/web3.js'
import { CONFIG } from './config'

/**
 * Every pump.fun token belongs to exactly one sector, decided by its own mint
 * address. pump.fun's vanity grind targets the `pump` SUFFIX, so the leading
 * bytes are effectively uniform — which makes this a fair partition nobody,
 * including us, can influence.
 */
export function sectorOf(mint: string): number {
  return new PublicKey(mint).toBytes()[0] % CONFIG.SECTOR_COUNT
}

export function coordsOf(sector: number): { row: number; col: number } {
  return {
    row: Math.floor(sector / CONFIG.GRID_SIZE),
    col: sector % CONFIG.GRID_SIZE,
  }
}

export function sectorAt(row: number, col: number): number {
  return row * CONFIG.GRID_SIZE + col
}

/** Orthogonal neighbours only, bounded by the grid edge. The field does not wrap. */
export function neighbors(sector: number): number[] {
  const { row, col } = coordsOf(sector)
  const n = CONFIG.GRID_SIZE
  const out: number[] = []
  if (row > 0) out.push(sectorAt(row - 1, col))
  if (row < n - 1) out.push(sectorAt(row + 1, col))
  if (col > 0) out.push(sectorAt(row, col - 1))
  if (col < n - 1) out.push(sectorAt(row, col + 1))
  return out
}
