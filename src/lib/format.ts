export const LAMPORTS_PER_SOL = 1_000_000_000

export function sol(lamports: number, digits = 3): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(digits)
}

export function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

export function shortKey(key: string, size = 4): string {
  return key.length <= size * 2 + 1 ? key : `${key.slice(0, size)}..${key.slice(-size)}`
}

export function pumpUrl(mint: string): string {
  return `https://pump.fun/coin/${mint}`
}

export function solscanUrl(address: string, kind: 'tx' | 'account' = 'account'): string {
  const cluster = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? '' : '?cluster=devnet'
  return `https://solscan.io/${kind}/${address}${cluster}`
}

/** weight = balance * (1 + min(depth, cap) / k) */
export function multiplier(depth: number, cap: number, k: number): number {
  return 1 + Math.min(depth, cap) / k
}
