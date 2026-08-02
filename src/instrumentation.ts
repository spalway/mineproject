/**
 * Boots the PUMPJACK runtime once per server process: the PumpPortal
 * websocket, the epoch clock, and the payout loop.
 *
 * This is why the app needs a long-lived node server and cannot run on
 * serverless — a persistent socket has nowhere to live there.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { startRuntime } = await import('./lib/runtime')
  startRuntime()
}
