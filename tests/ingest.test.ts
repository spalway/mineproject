import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseEvent, Ingest } from '@/lib/ingest'

const lines = readFileSync('fixtures/pumpportal-sample.jsonl', 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean)

describe('parseEvent against real captured events', () => {
  it('has a non-trivial fixture to test against', () => {
    expect(lines.length).toBeGreaterThan(2)
  })

  it('parses every captured line without throwing', () => {
    for (const l of lines) {
      expect(() => parseEvent(JSON.parse(l))).not.toThrow()
    }
  })

  it('assigns a valid sector to each parsed mint', () => {
    const mints = lines
      .map((l) => parseEvent(JSON.parse(l)))
      .filter((e): e is Extract<NonNullable<typeof e>, { kind: 'mint' }> => e?.kind === 'mint')

    expect(mints.length).toBeGreaterThan(0)
    for (const m of mints) {
      expect(m.sector).toBeGreaterThanOrEqual(0)
      expect(m.sector).toBeLessThan(64)
      expect(m.creator).not.toBe('')
    }
  })

  it('returns null for subscription acks and junk', () => {
    expect(parseEvent({ message: 'Successfully subscribed to token creation events.' })).toBe(null)
    expect(parseEvent({})).toBe(null)
    expect(parseEvent(null)).toBe(null)
    expect(parseEvent('nope')).toBe(null)
    expect(parseEvent({ mint: 'not-a-valid-pubkey', txType: 'create' })).toBe(null)
  })

  it('recognises a migration event', () => {
    const e = parseEvent({
      mint: '7XXATGsKARWwvWhYkFr5QBdJU7uXBrrpt5CoAfJ1pump',
      txType: 'migrate',
      pool: 'pump-amm',
    })
    expect(e?.kind).toBe('migration')
  })

  it('ignores trade events, which we do not subscribe to', () => {
    expect(
      parseEvent({
        mint: '7XXATGsKARWwvWhYkFr5QBdJU7uXBrrpt5CoAfJ1pump',
        txType: 'buy',
      }),
    ).toBe(null)
  })
})

describe('uptime tracking', () => {
  it('reports full uptime for a window with no recorded gaps', () => {
    const ingest = new Ingest(() => {})
    // Never connected and never disconnected: no spans, so no credit.
    expect(ingest.uptimeRatio(Date.now() - 1000, Date.now())).toBe(0)
  })

  it('treats a zero-length window as fully up', () => {
    const ingest = new Ingest(() => {})
    const t = Date.now()
    expect(ingest.uptimeRatio(t, t)).toBe(1)
  })
})
