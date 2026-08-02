# PUMPJACK — Design Spec

**Date:** 2026-08-02
**Status:** Approved for planning
**Network (v1):** Solana devnet, mainnet behind a config flag

---

## 1. Positioning

pump.fun emits thousands of tokens per hour. Almost all of them are worthless individually. PUMPJACK treats that aggregate emission as a **measurable physical field** and lets people position capital inside it.

The one-line pitch: *the launchpad is sediment; we built the machine that sits in the flow.*

The credibility of the entire protocol rests on a single verifiable claim, stated up front on the site:

```ts
sector = mintPubkey.toBytes()[0] % SECTOR_COUNT   // SECTOR_COUNT = 64 in v1
```

Every pump.fun token belongs to exactly one of 64 sectors, decided by its own mint address. This works because pump.fun's vanity grind targets the `pump` **suffix**, leaving the leading bytes effectively uniform. The partition is permanent, permissionless, and independently checkable by anyone in one line of code. No operator — including us — can move a token between sectors.

---

## 2. Naming system

Five sections, one syllable each, no articles. Reads as instrument labels, not chapter titles.

| Section | Purpose |
|---|---|
| `FIELD` | 8×8 grid, epoch clock, deploy panel |
| `FLOW` | live mint stream landing in sectors |
| `DEPTH` | your rigs, accrual, weight, withdraw |
| `RIFT` | linked sectors, crew fractures |
| `VEIN` | jackpot, graduations, strike ledger |

Mechanic vocabulary — all nouns that do a job, no filler: **sector**, **epoch**, **grade**, **strike**, **rig**, **draw**, **depth**, **rift**, **vein**.

A *rift* is a fracture propagating through rock, not a mine tunnel. Chosen deliberately over "drift": crews don't dig, they crack the field open, and a spreading fracture line is a far better visual than a corridor.

---

## 3. Core mechanic

### 3.1 Grade and strike

Each epoch lasts 120 seconds. During an epoch:

- `grade[s]` = count of new pump.fun mints observed landing in sector `s`
- The sector with the highest grade **strikes**

**Epoch length is calibrated against measured throughput, not guessed.** A 240-second live capture gave **13.3 mints/min**. Monte-Carlo over that rate (`scripts/analyze-rate.mjs`):

| Grid | Epoch | Mints/epoch | Avg winning grade | Degenerate (max ≤ 1) |
|---|---|---|---|---|
| 8×8 | 60s | 13.3 | 1.79 | **29.2%** |
| 8×8 | 120s | 26.5 | 2.47 | 1.4% |
| 6×6 | 120s | 26.5 | 3.01 | 0.1% |

A *degenerate* epoch is one where the winning grade is 1: the strike collapses to "whichever sector caught the first mint of the epoch" and the grid stops being a contest. At 60 seconds that happens in nearly a third of epochs, which is unacceptable for a design whose entire premise is that the grid is the product. 120 seconds fixes it while keeping the 8×8 field, and 64 cells gives rifts room to propagate visually. A typical winning grade is 2–3: tight and legible, with individual arrivals still visible in the UI.

Throughput varies with market conditions. If the sustained rate drops materially below ~10 mints/min, either `EPOCH_MS` or `GRID_SIZE` needs re-tuning — re-run the analysis script rather than guessing.

**Tie-break — first to grade.** Among sectors tied at the winning count `k`, the winner is the sector whose `k`-th mint arrived earliest. Deterministic, derived only from observed arrival order, unforgeable by any participant.

> **Documented limitation:** arrival timestamps are our *ingest receipt* time, not chain time. The site must say so plainly rather than implying block-level ordering. Receipt time is recorded per event and is monotonic within a process.

### 3.2 Rigs, draw, depth

ORE wipes losing stakes every round, so nothing persists across rounds and vesting is structurally impossible. PUMPJACK inverts this so capital *stays*:

- A deploy creates a **rig**. It persists across epochs until withdrawn.
- Each epoch, every active rig is charged a **draw**: 1% of its balance, into the epoch pot. The rig burns fuel.
- Strikers split the pot pro-rata by weight. **Principal is never seized.**
- **Depth** = consecutive epochs survived.

```
weight = balance × (1 + min(depth, 60) / 30)
```

Depth caps at 60 epochs (two hours at a 120s epoch) for a maximum 3× weight multiplier. Withdrawing and redeploying resets depth to zero. **Striking does not reset depth** — a winning rig keeps running and keeps its accrual.

A wallet may hold multiple rigs in the same sector. Each deploy is a distinct rig with its own balance and its own depth clock, keyed by its deploy signature.

**Draw rate and depth cap are deliberately matched.** At 1% per epoch a rig's balance halves in ~69 epochs, which lands just past the 60-epoch depth cap. A rig therefore reaches maximum weight at roughly the moment it has burned half its fuel — the multiplier peaks exactly when the position starts getting expensive to hold. Both constants are tunable, but they should be tuned together.

The result is a machine that consumes fuel continuously and pays out when its sector hits, hitting harder the longer it has run. That is a mining rig, not a roulette spin, and it is what makes leaving capital in the correct play.

### 3.3 Pot split

Let `P` = total draws collected in an epoch.

| Recipient | Share of P |
|---|---|
| Treasury | 4% |
| Vein | 6% |
| Strikers | 75% |
| Rift claimants | 15% |

If no rift claimants exist, their 15% rolls to strikers (strikers take 90%).

**Unoccupied strike.** The highest-grade sector frequently contains no rigs at all — nothing forces miners to be where the tokens land. When the striking sector is empty there are no strikers, and because rifts are components of *occupied* sectors, an empty sector belongs to no component, so there are no rift claimants either. In that case the full 90% rolls into the vein and the treasury still takes its 4%. The field swallowed the epoch. This is the common case early on and it is what makes the vein grow into something worth chasing.

Within each group, distribution is pro-rata by `weight`.

### 3.4 Rift

A rift is a **connected component of occupied sectors** — sectors containing at least one active rig — using 4-neighbour orthogonal adjacency on the bounded 8×8 grid. No wrapping.

Components are computed across **all wallets**, not per-wallet. You benefit from strangers deploying beside you. This is the collaborative layer and it is genuinely collaborative.

**Rift claimants** for a strike = active rigs in sectors at graph distance 1 or 2 from the striking sector, traversing only occupied sectors. The distance cap of 2 bounds the blast radius so locality keeps meaning; without it a board-spanning component would pay everyone and the mechanic would collapse.

### 3.5 Vein

The vein accrues 6% of every epoch pot and pays out **only** when a real migration event (bonding curve complete → PumpSwap) lands in the striking sector during that epoch. The full vein balance is split pro-rata by weight among that sector's rigs, and the vein resets to zero.

If the striking sector is unoccupied the vein does not pay, even when a migration lands there. It keeps accruing. Rift claimants never draw from the vein — it belongs to strikers alone.

The same 240s capture recorded 3 migrations alongside 53 creates. At ~0.75 migrations per minute across 64 sectors, a migration lands in the striking sector roughly once every 40–90 epochs — a jackpot every hour or two. Rare, dramatic, on-chain, and unfakeable.

### 3.6 Void epochs

If the ingest websocket is disconnected for more than 20% of an epoch's wall time:

- No draw is charged
- No strike occurs
- Depth still accrues
- The field renders `DARK`

**We never synthesize mints to cover a gap.** One fabricated data point destroys the "verify it yourself" claim that the whole protocol rests on. This is a hard constraint, not a preference.

### 3.7 Contestability (known, intentional)

Anyone can push a sector's grade by launching pump.fun tokens into it. This costs real SOL per launch and is fully visible in `FLOW` as it happens.

This is treated as a **feature, not an exploit**: the field is contestable, buying grade has a real price, and everyone watches you pay it. The site states this openly.

One cheap guard: **a single creator address contributes at most 1 counted mint per sector per epoch.** This defeats trivial one-wallet spam. Sybil attacks remain possible at higher cost, and the spec acknowledges that rather than claiming immunity.

### 3.8 Constants

| Constant | Value |
|---|---|
| `GRID` | 8 × 8 = 64 sectors |
| `EPOCH_MS` | 120_000 |
| `DRAW_BPS` | 100 (1% of rig balance per epoch) |
| `TREASURY_BPS` | 400 |
| `VEIN_BPS` | 600 |
| `STRIKER_BPS` | 7500 (9000 when no rift claimants) |
| `RIFT_BPS` | 1500 |
| `RIFT_MAX_DISTANCE` | 2 |
| `DEPTH_CAP` | 60 epochs |
| `DEPTH_K` | 30 |
| `VOID_THRESHOLD` | 20% of epoch disconnected |
| `MIN_DEPLOY` | 0.01 SOL |
| `MEMO_TAG` | `PJ1:<sector>` |

`GRID` is a tunable config constant. 8×8 suits current launch volume; if pump.fun throughput drops materially, 6×6 keeps the race tight.

---

## 4. Architecture

```
pumpportal WS ──> ingest ──> SQLite ──> engine (60s tick)
                                │            │
                            REST API    SSE /api/stream
                                └─────┬──────┘
                              Next.js client
                                      │
                            wallet-adapter ──> devnet
```

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · `@solana/wallet-adapter` · `@solana/web3.js` · `node:sqlite` · `ws`

Storage uses Node 24's first-party `node:sqlite` (`DatabaseSync`) rather than `better-sqlite3`. Same synchronous API shape, but no native compile step — which matters because npm blocks install scripts by default here and native builds fail on Windows without a toolchain.

Wallet support relies on Wallet Standard auto-registration, so `@solana/wallet-adapter-wallets` is not installed. Phantom, Solflare, and Backpack self-register. The meta-package pulls in `@stellar/stellar-sdk`, whose postinstall requires yarn and breaks the install outright.

### 4.1 Modules

Each has one job, a narrow interface, and is testable in isolation.

| Module | Responsibility | Pure? |
|---|---|---|
| `sector.ts` | mint pubkey → sector, grid coords, adjacency | yes |
| `ingest.ts` | pumpportal WS, reconnect/backoff, event normalisation, connection-uptime tracking | no |
| `engine.ts` | epoch resolution: grade, tie-break, void determination | yes (given snapshot) |
| `rift.ts` | occupied-sector components, BFS distance ≤ 2 | yes |
| `payout.ts` | weights, group splits, integer lamport allocation | yes |
| `chain.ts` | tx verification, treasury transfers, signature checks | no |
| `stream.ts` | SSE fan-out to connected clients | no |

All interesting logic is pure functions over a state snapshot, so the mechanic is unit-testable with zero network access.

### 4.2 Deploy transaction flow

No smart contract is required for v1.

1. Client builds `SystemProgram.transfer(wallet → treasury, lamports)` plus a Memo instruction `PJ1:<sector>`
2. Wallet signs and submits; client POSTs the signature to `/api/deploy`
3. Server calls `getTransaction` and **independently verifies**: destination is the treasury, lamports match, memo parses to a valid sector, fee payer matches the claimed wallet, `blockTime` is within tolerance, signature is unused
4. Rig activates at the next epoch boundary

The server trusts nothing the client asserts — it re-reads the chain. Every deploy is a real signature that resolves on Solscan.

### 4.3 Withdraw flow

Withdraw requires proof of wallet ownership: server issues a nonce, client signs it via `signMessage`, server verifies the ed25519 signature against the rig's wallet. Payout is a treasury transfer of the remaining balance. The rig closes and depth is discarded.

### 4.4 Payout execution

At epoch close the engine computes all allocations, writes `payouts` rows as `pending`, then batches `SystemProgram.transfer` instructions (~10 per transaction) signed by the treasury keypair. Each row is marked `sent` with its signature. Idempotent on `(epoch_id, rig_id, kind)` so retries cannot double-pay.

**Integer lamport discipline:** allocations use largest-remainder distribution. A test asserts that striker + rift + treasury + vein payouts sum **exactly** to `P` for arbitrary inputs. No dust creation, no rounding leakage.

---

## 5. Data model (SQLite)

```sql
epochs(id, started_at, ended_at, status, strike_sector, pot_lamports,
       treasury_lamports, vein_add_lamports, vein_paid_lamports,
       migration_mint, mint_count, uptime_ratio)

mints(mint PK, sector, epoch_id, received_at, name, symbol, uri, creator, counted)

migrations(mint PK, sector, epoch_id, received_at)

rigs(id PK, wallet, sector, balance_lamports, depth, status,
     deploy_sig UNIQUE, created_epoch, closed_epoch)

draws(id PK, rig_id, epoch_id, lamports)

payouts(id PK, epoch_id, wallet, rig_id, kind, lamports, signature, status)

vein(id=1, balance_lamports)

used_sigs(signature PK)
```

`mints.counted` records whether the mint contributed to grade, so the per-creator cap in §3.7 is auditable rather than silent.

---

## 6. API surface

| Endpoint | Purpose |
|---|---|
| `GET /api/state` | full snapshot: epoch, grades, rigs, rifts, vein, recent strikes |
| `GET /api/stream` | SSE: `mint`, `grade`, `tick`, `strike`, `vein`, `rift`, `void`, `deploy` |
| `POST /api/deploy` | `{ signature, sector }` → verify on-chain, create rig |
| `GET /api/nonce?wallet=` | issues a short-lived single-use nonce for withdraw auth |
| `POST /api/withdraw` | `{ wallet, rigId, nonce, signature }` → close rig, return balance |
| `GET /api/wallet/:pubkey` | rigs, depth, payout history |
| `GET /api/epochs?limit=` | strike history |
| `GET /api/verify/:mint` | returns the sector derivation for any mint — a public trust endpoint |

SSE is chosen over a client websocket: the stream is one-way, it survives proxies cleanly, and it needs no reconnect protocol of its own.

---

## 7. Sections

1. **FIELD** — hero. Live 8×8 grid, epoch clock, deploy panel. Cells pulse as real mints land. Fully functional with no wallet connected, so the mechanism is visibly working before anyone commits anything.
2. **FLOW** — live mint ticker with sector tags and per-sector grade sparklines. Every row links out to pump.fun and Solscan. This is the section that proves the data is real.
3. **DEPTH** — your rigs, depth curve, weight multiplier, draw burn rate, withdraw.
4. **RIFT** — live fracture map, largest active rifts, crew leaderboard.
5. **VEIN** — vein balance, graduation feed, strike history and payout ledger with signatures.

Plus `/about` — an ORE-style docs page. Five short paragraphs, one idea each, no walls of text.

### 7.1 Visual language — green phosphor terminal

The entire site is a CRT terminal. Black background, phosphor green text, monospace everywhere, ASCII and box-drawing characters instead of drawn shapes. Reference point is Truth Terminal — which is also pump-ecosystem canon, so the aesthetic reads as native rather than borrowed.

**Palette.** Only three colours carry meaning:

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#050705` | background |
| `--green` | `#33ff66` | primary text, grade, strike |
| `--green-dim` | `#1a7a33` | borders, inactive sectors, chrome |
| `--amber` | `#ffb000` | **vein only** |

Amber is an authentic amber-CRT phosphor, so reserving it for the vein stays visually coherent while keeping the rule from §7: exactly one signal colour, and it means jackpot. Nothing else may use amber.

**Type.** A single monospace stack, no proportional font anywhere on the site — including headings and body copy. Every glyph occupies one cell.

**The field is real ASCII.** The 8×8 grid is a character matrix drawn with box-drawing glyphs, not a CSS grid of divs styled to look like one. Sector state maps to density:

```
      00 01 02 03 04 05 06 07
   ┌────────────────────────────┐
00 │  ·  ·  ▒  ·  ·  ░  ·  ·    │
01 │  ·  ░  ·  ·  █══█  ·  ·    │
02 │  ▒  ·  ·  ·  ║  ·  ·  ·    │
```

- `·` empty sector, no grade
- `░ ▒ ▓` ascending grade this epoch
- `█` occupied by at least one rig
- `═ ║` rift links between adjacent occupied sectors
- Striking sector inverts to solid and flashes for one second

Because everything is characters on a fixed grid, rift fractures render as actual connected line-drawing runs — the tunnels are literally drawn in text.

**CRT treatment.** Subtle scanline overlay, faint text-shadow bloom on green, and a short boot sequence on first load that types out a status banner and then hands over to the live field. The boot sequence must never gate or delay the real data — it plays over an already-connected stream.

**shadcn** still supplies Dialog, Tooltip, Table, Tabs, ScrollArea, Sonner and friends for behaviour and accessibility, restyled to the terminal palette. Components provide focus management and keyboard handling; the terminal skin is purely presentational on top.

---

## 8. Error handling

| Failure | Behaviour |
|---|---|
| WS disconnect | exponential backoff reconnect; uptime tracked per epoch |
| Uptime < 80% in an epoch | epoch marked `void` (§3.6) |
| RPC failure on deploy verify | deploy rejected with a retryable error; no rig created |
| Payout transfer failure | row stays `pending`, retried next tick, idempotent |
| Malformed WS event | logged and dropped; never inferred or backfilled |
| Zero rigs deployed in an epoch | pot is 0; strike still recorded for history |
| Striking sector unoccupied | 90% of pot rolls to vein; vein does not pay out (§3.3, §3.5) |
| Nonce reused or expired | withdraw rejected; rig untouched |

---

## 9. Testing

- **Unit (vitest):** `sector.ts` against known pubkeys plus uniformity over a fixture set; `engine.ts` grade/tie-break/void; `rift.ts` components and distance cap; `payout.ts` weights, splits, and exact-sum lamport conservation, including the unoccupied-strike path where 90% routes to the vein
- **Fixture replay:** recorded pumpportal JSONL → deterministic epoch outcomes, asserting the same input always yields the same strike
- **Devnet e2e:** deploy → verify → strike → payout, asserting real on-chain balance deltas

---

## 10. Deployment

Node 20+, single long-running process. Railway, Fly, Render, or a VPS.

**This cannot run on Vercel serverless** — a persistent websocket plus SQLite requires a live process. This is an architectural constraint, not a preference.

Environment: `RPC_URL`, `TREASURY_SECRET_KEY`, `NETWORK` (`devnet` | `mainnet`), `PUMPPORTAL_WS`.

---

## 11. Honesty constraints

These are binding on implementation:

- **No fabricated metrics.** Every number displayed as on-chain data is read from chain or from the live feed. No seeded TVL, no invented user counts, no synthetic mints during outages.
- **Custody is disclosed.** Payouts run from a server keypair. On devnet this is immaterial; if the mainnet flag is ever flipped, the site must state the custody model plainly and publish the treasury address so flows are auditable.
- **Contestability is disclosed** (§3.7) rather than papered over.
- **Timestamp semantics are disclosed** (§3.1) — receipt time, not chain time.
- **Feed dependency is disclosed.** PumpPortal's free tier carries no SLA; void epochs are the honest handling, and a Helius/Geyser fallback is a later addition.

Lore, naming, and "novel primitive" framing are marketing and are fair game. Data integrity is not.

---

## 12. Known unknowns

- **Event field names.** PumpPortal's docs show subscription payloads but not response schemas. The parser will be locked against captured live events during implementation, not guessed from documentation.
- **Grid tuning.** 8×8 assumes current launch volume; `GRID` stays a config constant.

---

## 13. Non-goals for v1

On-chain Anchor program · mainnet launch · paid trade-volume streams · a PUMPJACK token · referral system · mobile app.
