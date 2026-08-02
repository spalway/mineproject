/**
 * Message formats shared by client and server. Both sides must produce the
 * byte-identical string or signature verification fails, so this lives in one
 * module with no server-only imports.
 */
export function withdrawMessage(rigId: number, nonce: string): string {
  return `PUMPJACK withdraw\nrig: ${rigId}\nnonce: ${nonce}`
}
