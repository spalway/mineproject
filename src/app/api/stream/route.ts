import { bus, type BusEvent } from '@/lib/bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * One-way live feed. SSE rather than a websocket: the browser only ever
 * listens, EventSource reconnects on its own, and it survives proxies that
 * mangle websocket upgrades.
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder()

  let unsubscribe: (() => void) | null = null
  let keepalive: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      let closed = false

      const write = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closed = true
        }
      }

      const teardown = () => {
        if (closed) return
        closed = true
        unsubscribe?.()
        if (keepalive) clearInterval(keepalive)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }

      write(': connected\n\n')
      unsubscribe = bus.subscribe((e: BusEvent) => write(`data: ${JSON.stringify(e)}\n\n`))
      keepalive = setInterval(() => write(': keepalive\n\n'), 15_000)

      req.signal.addEventListener('abort', teardown)
    },

    cancel() {
      unsubscribe?.()
      if (keepalive) clearInterval(keepalive)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
