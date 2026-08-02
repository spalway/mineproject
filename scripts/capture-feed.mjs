/**
 * Capture live PumpPortal events to a fixture file.
 *
 * The PumpPortal docs publish the subscribe payloads but not the response
 * schemas, so the parser is locked against real captured events rather than
 * guessed. Re-run this if the upstream shape ever changes.
 *
 *   node scripts/capture-feed.mjs [outfile] [seconds]
 */
import WebSocket from 'ws'
import { createWriteStream, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const outfile = process.argv[2] ?? 'fixtures/pumpportal-sample.jsonl'
const seconds = Number(process.argv[3] ?? 45)

mkdirSync(dirname(outfile), { recursive: true })
const out = createWriteStream(outfile, { flags: 'w' })

const ws = new WebSocket('wss://pumpportal.fun/api/data')
let count = 0

ws.on('open', () => {
  console.error('connected, subscribing')
  ws.send(JSON.stringify({ method: 'subscribeNewToken' }))
  ws.send(JSON.stringify({ method: 'subscribeMigration' }))
})

ws.on('message', (buf) => {
  out.write(buf.toString() + '\n')
  count++
})

ws.on('error', (e) => {
  console.error('ws error:', e.message)
  process.exit(1)
})

setTimeout(() => {
  console.error(`captured ${count} events to ${outfile}`)
  out.end()
  ws.close()
  process.exit(0)
}, seconds * 1000)
