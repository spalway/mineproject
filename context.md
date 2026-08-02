# nodei — context

Reference for writing about the project. Everything here is accurate as built.
If a claim isn't in this file, check before saying it.

- **site:** nodei.app
- **handle:** @nodeimines
- **repo:** github.com/spalway/mineproject
- **treasury:** `HSiExrCCPCBLpD3Wuot7uad8Mv4Lms5hdViKYsK3VSFK`

---

## 1. The one-liner

> a collaborative mining pool laid out as a 64 sector field. hold the token,
> claim a sector, earn a share of creator fees every ten minutes.

## 2. The elevator version

pump.fun emits thousands of tokens a day. nodei treats that stream as a
measurable field and lets people take a position inside it.

The field is 64 sectors. Every pump.fun token that has ever launched belongs to
exactly one of them — decided by its own mint address, not by us. Hold 10,000
nodei and you can claim one sector with a signature. Every ten minutes the board
is ranked by which sector caught the most launches, and 70% of the creator fees
that arrived in the treasury gets split across the board.

You don't stake. You don't deposit. Claiming is a signed message — no
transaction, no gas, nothing leaves your wallet.

## 3. How it actually works

**The partition.** Each sector owns a slice of the Solana address space:

```
sector = mintPubkey.toBytes()[0] % 64
```

This works because pump.fun's vanity grind targets the `pump` *suffix*, leaving
the leading bytes effectively random. So the assignment is uniform, permanent,
and nobody — including the operator — can move a token between sectors. Anyone
can recompute it in one line, or hit `/api/verify/<mint>` and check our answer
against their own.

**The round.** Ten minutes. Every new token that lands in a sector raises its
count, capped at one per creator per sector so one wallet can't cheaply
manufacture a win. The busiest sector comes out on top. Ties go to whichever
sector *reached* the count first — a footrace, not a coin flip.

**The pot.** 70% of the creator fees that arrived in the treasury since the last
round, measured as that wallet's balance change read from chain.

**The split.**

| leg | share | who |
|---|---|---|
| top sector | 50% | whoever holds the winning sector |
| neighbours | 20% | claimed sectors within two steps of it |
| pool | 30% | every claimed sector on the board |

That third leg is the important one: **holding a sector always earns
something.** It's a pool, not a lottery.

**Depth.** Every round your sector survives adds one depth, multiplying your
share weight up to 3× over 36 rounds (~6 hours). It costs nothing to accrue —
no stake, no burn, nothing at risk. You only lose it by releasing your sector or
dropping below the minimum.

**Neighbours.** Claimed sectors that touch are linked, counted across *all*
wallets rather than per wallet. You benefit from strangers claiming beside you.
That's the collaborative part, and it's real — not a metaphor.

## 4. The numbers

| | |
|---|---|
| sectors | 64 (8×8) |
| sectors per wallet | 1 |
| minimum to claim | 10,000 nodei |
| round length | 10 minutes |
| fee share to the pool | 70% |
| split | 50 / 20 / 30 |
| depth cap | 36 rounds → 3× weight |
| neighbour reach | 2 steps |
| cost to claim | one signature, zero gas |

**Measured, not estimated:** pump.fun currently emits ~11 launches/min. That's
~110 per 10-minute round across 64 sectors, so a winning sector typically sits
around 5. Tight enough to be a real race, sparse enough that you can watch
individual tokens land.

## 5. Vocabulary

Use these consistently. All lowercase, always.

- **field** — the 64 sector board
- **sector** — one cell, `00`–`63`
- **claim / release** — take or give up a sector, by signature
- **round** — the 10 minute cycle
- **strike** — a sector coming out on top for a round
- **rift** — a run of touching claimed sectors
- **depth** — consecutive rounds held
- **pot** — what's distributed in a round
- **carry** — a leg with nobody eligible, rolled into the next round
- **dark** — a round that couldn't be measured; nothing distributed, pot rolls forward
- **ledger** — the owed/paid record

## 6. What makes it interesting

Angles worth pulling on:

1. **You can't be assigned a bad sector by us.** The partition comes from the
   token's own address. It's the whole credibility of the thing and it's one
   line of code anyone can check.
2. **Claiming costs nothing.** No stake, no deposit, no gas. A signature that
   says in plain text that it moves no funds. Compare to every "stake to earn"
   design.
3. **It's a pool, not a lottery.** 30% goes to every claimed sector each round.
   Sitting on the board earns.
4. **You benefit from your neighbours.** The 20% leg means a stranger claiming
   next to you pays you. Genuinely cooperative game theory, not a slogan.
5. **Nothing is ever burned.** A leg with no eligible recipient carries forward.
   An empty board banks the whole pot.
6. **The board is contestable.** Anyone can push a sector by paying to launch
   tokens into it. It costs real SOL and it's visible. That's a feature.
7. **Depth rewards patience, not capital.** The multiplier comes from time held,
   not size held. A 10k wallet and a 10m wallet have identical weight.
8. **The server holds no private key.** It literally cannot move your funds.

## 7. Voice

The site is a flat dark-grey terminal: monospace, green text, ASCII, everything
lowercase. The mascot is a cat in a miner's helmet.

Write like the site reads:

- **lowercase throughout**
- terse, declarative, technical
- no hype adjectives, no rocket emojis, no "wen"
- let the mechanic be the interesting part
- specific numbers over vague excitement — "70% of creator fees, every 10
  minutes" beats "huge rewards"
- dry humour is on-brand; breathless is not

**Good:**
> 64 sectors. one per wallet. every ten minutes the board is ranked and 70% of
> creator fees gets split across it. claiming is a signature — no gas, nothing
> leaves your wallet.

**Bad:**
> 🚀 nodei is REVOLUTIONIZING mining on Solana!! 💎 MASSIVE rewards for early
> holders, don't miss out!!

## 8. Claims that are true

Safe to say, all verifiable:

- every pump.fun token belongs to exactly one sector, decided by its own address
- anyone can verify any token's sector independently
- claiming is a signature, not a transaction — no gas, no funds move
- one sector per wallet
- rounds run every ten minutes
- 70% of newly accrued creator fees funds each round's pot
- holding a sector earns from every round, not just when you win
- depth multiplies your share up to 3× and costs nothing to accrue
- weight comes from time held, not tokens held
- unclaimed legs carry forward instead of being burned
- the app holds no private key
- the treasury address is public
- balances are read from chain, never taken on the client's word

## 9. Claims to avoid

Not moralising — these are the ones that would get the project called out, and
each has a true version that's just as good.

**Don't say payouts are automatic or instant.** The round records what each
wallet has earned; settlement is sent from the treasury against that ledger and
a row reads `paid` once its signature is attached.
→ *Say:* "every round records what you've earned. the ledger shows owed and
paid, and every settlement carries its signature."

**Don't promise returns, yield figures, or APR.** The pot is whatever creator
fees actually arrived. It can be zero.
→ *Say:* "the pot is 70% of the fees that came in that round. no fees, no pot."

**Don't call the 70% enforced or on-chain.** It's an operator commitment; no
contract enforces it.
→ *Say:* "70% of creator fees goes to the pool. the treasury is public — check
the flows."

**Don't invent metrics.** No made-up TVL, holder counts, or volume. The site
shows `--` rather than a number it hasn't read, and the writing should match.

**Don't imply the token is live before it is.** Claiming is closed until the
mint is set.

**Don't call it risk-free or guaranteed.** It's honest that claiming risks no
funds — that's a real and unusual claim. Don't stretch it into a promise about
outcomes.

## 10. Ready-made angles

- the partition explained in one line of code
- "claiming costs one signature and zero gas" vs staking designs
- why 30% goes to everyone — the pool-not-lottery point
- the neighbour mechanic: strangers beside you pay you
- depth: time held beats size held
- what a dark round is and why nothing is ever invented to fill it
- a walkthrough of a real round log — board, top sector, who got what
- the contestability angle: you can pay to move the board, visibly
- measured launch rate and why the round is 10 minutes, not 1

## 11. Status

- field, rounds, ranking, splits, ledger: **live**
- storage: Supabase Postgres
- treasury: wired and read from chain each round
- **token: not launched.** claiming is closed until the mint is set — the gate
  fails closed, not open
- USD price display: wired, dormant until an API key is set

Don't write anything implying claiming is open yet.
