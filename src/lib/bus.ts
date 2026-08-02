import { EventEmitter } from 'node:events'

/**
 * In-process fan-out. The ingest worker and epoch tick publish here; SSE route
 * handlers subscribe. Nothing crosses a process boundary, which is why the
 * whole app has to run as one long-lived node server.
 */
export type BusEvent =
  | { type: 'mint'; mint: string; sector: number; symbol: string | null; name: string | null; at: number }
  | { type: 'migration'; mint: string; sector: number; at: number }
  | { type: 'grade'; grades: number[] }
  | { type: 'tick'; epochId: number; startedAt: number; endsAt: number }
  | {
      type: 'strike'
      epochId: number
      sector: number | null
      pot: number
      veinPaid: number
      migrationMint: string | null
    }
  | { type: 'void'; epochId: number; uptimeRatio: number }
  | { type: 'vein'; balance: number }
  | { type: 'rift'; components: number[][] }
  | { type: 'deploy'; wallet: string; sector: number; lamports: number }

class Bus extends EventEmitter {
  publish(e: BusEvent) {
    this.emit('event', e)
  }
  subscribe(fn: (e: BusEvent) => void): () => void {
    this.on('event', fn)
    return () => this.off('event', fn)
  }
}

// Survives HMR in dev, where module state would otherwise be recreated.
const globalRef = globalThis as unknown as { __nodeiBus?: Bus }
export const bus: Bus = globalRef.__nodeiBus ?? new Bus()
bus.setMaxListeners(0)
globalRef.__nodeiBus = bus
