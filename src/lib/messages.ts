/**
 * Formats shared by client and server. Both sides must produce byte-identical
 * strings or verification fails, so this module has no server-only imports.
 */

export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

export const MEMO_TAG = 'PJ1'

/** Memo payload written into a deploy transaction: `PJ1:<sector>`. */
export function memoText(sector: number): string {
  return `${MEMO_TAG}:${sector}`
}

export function withdrawMessage(rigId: number, nonce: string): string {
  return `PUMPJACK withdraw\nrig: ${rigId}\nnonce: ${nonce}`
}
