/**
 * Formats shared by client and server. Both sides must produce byte-identical
 * strings or signature verification fails, so this module has no server-only
 * imports.
 *
 * These are deliberately readable in a wallet prompt: anyone signing should be
 * able to see that it claims a spot and moves nothing.
 */

export function claimMessage(sector: number, nonce: string): string {
  return [
    'nodei :: claim spot',
    `sector: ${sector}`,
    'this signature moves no funds',
    `nonce: ${nonce}`,
  ].join('\n')
}

export function releaseMessage(spotId: number, nonce: string): string {
  return [
    'nodei :: release spot',
    `spot: ${spotId}`,
    'this signature moves no funds',
    `nonce: ${nonce}`,
  ].join('\n')
}
