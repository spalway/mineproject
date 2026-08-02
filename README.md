# nodei

A collaborative mining pool laid out as a 64 sector field.

Hold the token, claim one sector with a signature, and every ten minutes the
board is ranked and a share of creator fees is split across it.

---

## How it works

1. **Hold** the minimum token balance. It is re-checked on chain at the start of
   every round, so a sector only stays yours while you still qualify.
2. **Claim** one open sector by signing a message. It is a signature, not a
   transaction — nothing moves, and the user pays no network fee.
3. **Rounds** close every ten minutes. Each sector is bound to a slice of the
   Solana token address space (`mintPubkey.toBytes()[0] % 64`), and its activity
   for the round is the count of new tokens that landed in it, capped at one per
   creator so a single wallet cannot manufacture a win cheaply. The busiest
   sector comes out on top; ties go to whichever reached the count first.
4. **The pot** is 70% of the creator fees that arrived in the treasury since the
   last close, measured as that wallet's balance change read from chain.
5. **The split** is 50% to the top sector, 20% across claimed sectors within two
   steps of it, and 30% across every claimed sector on the board. Any leg with
   nobody eligible carries into the next round rather than vanishing.

## Design constraints

These are load-bearing, not preferences:

- **The server holds no private key.** Claiming is signature-only and payouts
  are sent from the treasury separately, so nothing in this process can move
  funds. The worst a compromise can do is misreport the ledger, which is public.
- **No fabricated data, ever.** If the activity feed drops for more than 20% of
  a round, the round closes `dark`: nothing is distributed and the pot rolls
  forward whole. Missing figures render as `--`, never as `0`.
- **Money is integer lamports end to end.** Allocation uses largest-remainder so
  every split sums to the pot exactly. There is a test asserting this over
  randomised inputs.
- **The client is never trusted.** Token balances are read from chain
  server-side; the browser's claim about what a wallet holds is ignored.

## Running it

```bash
npm install
cp .env.example .env.local
npm run dev
```

```bash
npm test
npm run build
npm start
```

## Deploying

The app **must run as a single long-lived Node process**. It holds a persistent
websocket to the activity feed and owns the round clock, neither of which
survives on serverless. Railway, Fly, Render or a plain VPS all work; Vercel
does not.

Two things to get right:

1. **`NODEI_DB` must point at a persistent volume.** Otherwise every redeploy
   wipes the round history and the owed ledger.
2. **Use a real RPC endpoint.** Each round close costs one treasury balance read
   plus one token balance read per claimed sector. The public endpoint will
   throttle that.

Run exactly one instance. A second process would open a second round clock and
double-resolve rounds.

### Going live checklist

- [ ] `RPC_URL` set to a dedicated endpoint
- [ ] `NEXT_PUBLIC_TREASURY_ADDRESS` set to the fee-receiving wallet
- [ ] `NODEI_DB` on a persistent volume
- [ ] Token deployed, then set `token_mint` in the `config` table — claiming
      stays closed until it is, and the change applies on the next request with
      no redeploy
- [ ] `BIRDEYE_API_KEY` if you want the contract bar to show live figures

## Supabase

`supabase/schema.sql` is the Postgres mirror of the SQLite schema — idempotent,
paste into the SQL editor. It provisions the tables, partial unique indexes
enforcing one live sector per wallet and per sector, RLS (public read on
everything auditable, service-role for writes), helper views, and a CHECK
constraint making it impossible to record a payout as `paid` without a
transaction signature attached.

**The runtime does not read from it yet.** `src/lib/db.ts` is synchronous
SQLite; pointing it at Postgres means making the data layer async, which ripples
through the round engine and every route. The schema and env vars are staged for
that, but the app currently runs on SQLite.

## Layout

```
src/lib/          sector, rift, payout, engine  — pure, no I/O, unit tested
                  db, ingest, chain, runtime    — storage, feed, chain, clock
src/app/          pool, history, position, mechanics, docs + API routes
supabase/         Postgres schema
scripts/          brand asset renderer, feed capture, rate analysis
brand/            generated pfp and banner
```

The mechanic lives in four pure modules that take a state snapshot and return a
result. They have no network or database access, which is why the whole payout
model is testable offline.
