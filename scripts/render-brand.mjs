/**
 * Generates the brand assets from the site's own palette, so they cannot
 * drift from the UI.
 *
 *   node scripts/render-brand.mjs
 *
 * Outputs SVG (source of truth) and PNG (what Twitter wants) into brand/.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import sharp from 'sharp'

const BG = '#232323'
const GREEN = '#4af08a'
const DIM = '#7c8b80'
const FAINT = '#3c403d'
const RED = '#ff4d4d'

const MONO = "ui-monospace, 'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Courier New', monospace"

// Same source the site renders from, so the pfp can never drift from the UI.
const CAT = JSON.parse(readFileSync('src/lib/cat.json', 'utf8')).art

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ------------------------------------------------------------------- pfp

function pfp() {
  const SIZE = 400
  const FONT = 22
  const LINE = 25

  // The art is ragged, so it must be laid out LEFT-aligned from one shared x.
  // Centring each line independently would shear the drawing apart.
  const cols = Math.max(...CAT.map((l) => l.length))
  const charWidth = FONT * 0.6 // monospace advance
  const blockWidth = cols * charWidth
  const blockHeight = CAT.length * LINE

  const left = (SIZE - blockWidth) / 2
  const top = (SIZE - blockHeight) / 2 + FONT * 0.8

  const lines = CAT.map(
    (l, i) =>
      `<text x="${left.toFixed(1)}" y="${(top + i * LINE).toFixed(1)}" font-family="${MONO}" ` +
      `font-size="${FONT}" fill="${GREEN}" text-anchor="start" xml:space="preserve">${esc(l)}</text>`,
  ).join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>
  <rect x="10.5" y="10.5" width="${SIZE - 21}" height="${SIZE - 21}" fill="none" stroke="${FAINT}" stroke-width="1"/>
  ${lines}
</svg>`
}

// ---------------------------------------------------------------- banner

/**
 * No text by request. It is the field itself: a lattice of sectors, mostly
 * empty, a few graded, two closed. Deterministic — no Math.random, so the
 * banner regenerates identically every time.
 */
function banner() {
  const W = 1500
  const H = 500
  const CELL = 34
  const GAP = 8
  const STEP = CELL + GAP

  const cols = Math.ceil(W / STEP) + 1
  const rows = Math.ceil(H / STEP) + 1

  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * STEP - STEP / 2
      const y = r * STEP - STEP / 2

      // Distance from centre drives the fade, so the lattice dissolves
      // outward instead of stopping at a hard edge.
      const dx = (x + CELL / 2 - W / 2) / (W / 2)
      const dy = (y + CELL / 2 - H / 2) / (H / 2)
      const d = Math.sqrt(dx * dx + dy * dy)
      const fade = Math.max(0, 1 - d * 0.95)
      if (fade <= 0.02) continue

      // Deterministic pseudo-noise from the cell coordinates.
      const n = (Math.sin(r * 12.9898 + c * 78.233) * 43758.5453) % 1
      const v = Math.abs(n)

      let fill = 'none'
      let stroke = DIM
      let strokeOpacity = fade * 0.34

      if (v > 0.955) {
        fill = RED
        stroke = RED
        strokeOpacity = fade * 0.9
      } else if (v > 0.86) {
        fill = GREEN
        stroke = GREEN
        strokeOpacity = fade * 0.85
      }

      const fillOpacity = fill === 'none' ? 0 : fade * (fill === RED ? 0.2 : 0.17)

      cells.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${CELL}" height="${CELL}" ` +
          `fill="${fill}" fill-opacity="${fillOpacity.toFixed(3)}" ` +
          `stroke="${stroke}" stroke-opacity="${strokeOpacity.toFixed(3)}" stroke-width="1"/>`,
      )
    }
  }

  // A single fracture: two adjacent lit cells joined, the way a rift draws.
  const linkY = H / 2 - 4
  const links = [
    `<rect x="${W / 2 - 180}" y="${linkY}" width="${GAP}" height="2" fill="${GREEN}" fill-opacity="0.45"/>`,
    `<rect x="${W / 2 + 140}" y="${linkY}" width="${GAP}" height="2" fill="${GREEN}" fill-opacity="0.35"/>`,
  ].join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <g shape-rendering="crispEdges">
  ${cells.join('\n  ')}
  </g>
  ${links}
</svg>`
}

// ------------------------------------------------------------------ main

mkdirSync('brand', { recursive: true })

const assets = [
  { name: 'pfp', svg: pfp(), width: 400 },
  { name: 'banner', svg: banner(), width: 1500 },
]

for (const a of assets) {
  writeFileSync(`brand/${a.name}.svg`, a.svg)
  await sharp(Buffer.from(a.svg), { density: 288 })
    .resize(a.width)
    .png()
    .toFile(`brand/${a.name}.png`)
  console.log(`brand/${a.name}.svg + .png`)
}
