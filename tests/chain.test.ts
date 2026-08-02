import { describe, it, expect } from 'vitest'
import { Keypair } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { verifySignedMessage, isValidPubkey } from '@/lib/chain'
import { claimMessage, releaseMessage } from '@/lib/messages'

const sign = (kp: Keypair, message: string) =>
  bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey))

describe('verifySignedMessage', () => {
  it('accepts a genuine signature', () => {
    const kp = Keypair.generate()
    const msg = claimMessage(37, 'nonce-123')
    expect(verifySignedMessage(kp.publicKey.toBase58(), msg, sign(kp, msg))).toBe(true)
  })

  it('rejects a signature from a different wallet', () => {
    const a = Keypair.generate()
    const b = Keypair.generate()
    const msg = claimMessage(37, 'nonce-123')
    expect(verifySignedMessage(b.publicKey.toBase58(), msg, sign(a, msg))).toBe(false)
  })

  it('rejects a signature over a different sector', () => {
    const kp = Keypair.generate()
    const signed = sign(kp, claimMessage(37, 'n'))
    // A claim signed for sector 37 cannot be repointed at sector 12.
    expect(verifySignedMessage(kp.publicKey.toBase58(), claimMessage(12, 'n'), signed)).toBe(
      false,
    )
  })

  it('rejects a signature over a different nonce', () => {
    const kp = Keypair.generate()
    const signed = sign(kp, claimMessage(37, 'nonce-a'))
    expect(
      verifySignedMessage(kp.publicKey.toBase58(), claimMessage(37, 'nonce-b'), signed),
    ).toBe(false)
  })

  it('does not accept a claim signature as a release', () => {
    const kp = Keypair.generate()
    const signed = sign(kp, claimMessage(5, 'n'))
    expect(verifySignedMessage(kp.publicKey.toBase58(), releaseMessage(5, 'n'), signed)).toBe(
      false,
    )
  })

  it('rejects malformed input without throwing', () => {
    expect(verifySignedMessage('not-a-key', 'n', 'also-not')).toBe(false)
  })
})

describe('claim message', () => {
  it('states plainly that it moves nothing', () => {
    expect(claimMessage(7, 'abc')).toContain('moves no funds')
  })
  it('names the sector and nonce it is bound to', () => {
    const msg = claimMessage(7, 'abc')
    expect(msg).toContain('sector: 7')
    expect(msg).toContain('nonce: abc')
  })
})

describe('isValidPubkey', () => {
  it('accepts a real key', () => {
    expect(isValidPubkey(Keypair.generate().publicKey.toBase58())).toBe(true)
  })
  it('rejects junk', () => {
    expect(isValidPubkey('not-a-key')).toBe(false)
    expect(isValidPubkey('')).toBe(false)
  })
})
