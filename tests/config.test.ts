import { describe, it, expect } from 'vitest'
import { CONFIG } from '@/lib/config'

describe('config', () => {
  it('splits the pot to exactly 100%', () => {
    expect(
      CONFIG.TREASURY_BPS + CONFIG.VEIN_BPS + CONFIG.STRIKER_BPS + CONFIG.RIFT_BPS,
    ).toBe(10_000)
  })

  it('rolls the rift share to strikers when no rift exists', () => {
    expect(CONFIG.STRIKER_BPS + CONFIG.RIFT_BPS).toBe(CONFIG.STRIKER_BPS_NO_RIFT)
  })

  it('has a grid that matches sector count', () => {
    expect(CONFIG.GRID_SIZE ** 2).toBe(CONFIG.SECTOR_COUNT)
  })
})
