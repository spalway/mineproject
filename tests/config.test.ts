import { describe, it, expect } from 'vitest'
import { CONFIG } from '@/lib/config'

describe('config', () => {
  it('splits the round pot to exactly 100%', () => {
    expect(CONFIG.STRIKE_BPS + CONFIG.RIFT_BPS + CONFIG.POOL_BPS).toBe(10_000)
  })

  it('has a grid that matches sector count', () => {
    expect(CONFIG.GRID_SIZE ** 2).toBe(CONFIG.SECTOR_COUNT)
  })

  it('keeps the fee share within bounds', () => {
    expect(CONFIG.FEE_SHARE_BPS).toBeGreaterThan(0)
    expect(CONFIG.FEE_SHARE_BPS).toBeLessThanOrEqual(10_000)
  })

  it('caps the depth multiplier at 3x', () => {
    expect(1 + CONFIG.DEPTH_CAP / CONFIG.DEPTH_K).toBe(3)
  })

  it('runs rounds every ten minutes', () => {
    expect(CONFIG.ROUND_MS).toBe(600_000)
  })
})
