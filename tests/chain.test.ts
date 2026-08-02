import { describe, it, expect } from 'vitest'
import { Keypair } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { parseMemo, verifySignedMessage, memoInstruction } from '@/lib/chain'

describe('parseMemo', () => {
  it('parses a valid tag', () => {
    expect(parseMemo('PJ1:37')).toBe(37)
  })
  it('accepts sector 0', () => {
    expect(parseMemo('PJ1:0')).toBe(0)
  })
  it('tolerates surrounding whitespace', () => {
    expect(parseMemo('  PJ1:12  ')).toBe(12)
  })
  it('rejects a sector out of range', () => {
    expect(parseMemo('PJ1:64')).toBe(null)
    expect(parseMemo('PJ1:999')).toBe(null)
  })
  it('rejects a wrong tag', () => {
    expect(parseMemo('XX:3')).toBe(null)
  })
  it('rejects garbage', () => {
    expect(parseMemo('PJ1:abc')).toBe(null)
    expect(parseMemo('')).toBe(null)
    expect(parseMemo('PJ1:-1')).toBe(null)
  })
})

describe('memoInstruction', () => {
  it('round-trips through parseMemo', () => {
    const data = memoInstruction(42).data.toString('utf8')
    expect(parseMemo(data)).toBe(42)
  })
})

describe('verifySignedMessage', () => {
  it('accepts a genuine signature', () => {
    const kp = Keypair.generate()
    const nonce = 'nonce-123'
    const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(nonce), kp.secretKey))
    expect(verifySignedMessage(kp.publicKey.toBase58(), nonce, sig)).toBe(true)
  })

  it('rejects a signature from a different wallet', () => {
    const a = Keypair.generate()
    const b = Keypair.generate()
    const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode('n'), a.secretKey))
    expect(verifySignedMessage(b.publicKey.toBase58(), 'n', sig)).toBe(false)
  })

  it('rejects a signature over a different message', () => {
    const kp = Keypair.generate()
    const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode('one'), kp.secretKey))
    expect(verifySignedMessage(kp.publicKey.toBase58(), 'two', sig)).toBe(false)
  })

  it('rejects malformed input without throwing', () => {
    expect(verifySignedMessage('not-a-key', 'n', 'also-not')).toBe(false)
  })
})
