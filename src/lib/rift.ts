import { CONFIG } from './config'
import { neighbors } from './sector'

/**
 * A rift is a connected component of OCCUPIED sectors — sectors holding at
 * least one active rig. Components span all wallets, so you benefit from
 * strangers deploying beside you. That is the collaborative layer.
 */
export function riftComponents(occupied: Set<number>): number[][] {
  const seen = new Set<number>()
  const out: number[][] = []

  for (const start of occupied) {
    if (seen.has(start)) continue
    const component: number[] = []
    const stack = [start]
    seen.add(start)

    while (stack.length) {
      const s = stack.pop()!
      component.push(s)
      for (const n of neighbors(s)) {
        if (occupied.has(n) && !seen.has(n)) {
          seen.add(n)
          stack.push(n)
        }
      }
    }
    out.push(component.sort((a, b) => a - b))
  }
  return out
}

/**
 * Sectors that share in a strike without being the striking sector: occupied
 * sectors within RIFT_MAX_DISTANCE hops, traversing only occupied sectors.
 *
 * The distance cap is load-bearing. Without it a board-spanning component
 * would pay everyone and locality would stop mattering.
 */
export function riftClaimants(strikeSector: number, occupied: Set<number>): number[] {
  if (!occupied.has(strikeSector)) return []

  const dist = new Map<number, number>([[strikeSector, 0]])
  const queue: number[] = [strikeSector]
  const out: number[] = []

  while (queue.length) {
    const s = queue.shift()!
    const d = dist.get(s)!
    if (d >= CONFIG.RIFT_MAX_DISTANCE) continue

    for (const n of neighbors(s)) {
      if (!occupied.has(n) || dist.has(n)) continue
      dist.set(n, d + 1)
      out.push(n)
      queue.push(n)
    }
  }
  return out
}
