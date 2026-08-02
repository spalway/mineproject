-- =====================================================================
-- nodei — Supabase / Postgres schema
--
-- Mirrors the local SQLite schema in src/lib/db.ts one-for-one so the app
-- can move between them without a mechanic change.
--
-- Money is BIGINT lamports everywhere. Never store money as float.
-- Timestamps are BIGINT epoch milliseconds, matching Date.now() in the app,
-- with generated timestamptz columns alongside for querying by hand.
--
-- Run this whole file in the Supabase SQL editor. It is idempotent.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- config — operator-settable values
--
-- This is the table to touch. Dropping the token CA in here takes effect on
-- the next request, with no redeploy and no restart.
-- ---------------------------------------------------------------------
create table if not exists public.config (
  key        text primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);

comment on table public.config is
  'Operator-settable runtime values. Read at request time, so edits apply instantly.';

insert into public.config (key, value) values
  ('token_mint',       ''),
  ('treasury_address', 'HSiExrCCPCBLpD3Wuot7uad8Mv4Lms5hdViKYsK3VSFK'),
  ('min_token_balance','10000'),
  ('fee_share_bps',    '7000'),
  ('round_ms',         '600000'),
  ('claims_open',      'true')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- rounds — one row per 10 minute pool round
-- ---------------------------------------------------------------------
create table if not exists public.rounds (
  id                   bigserial primary key,
  started_at           bigint  not null,
  ended_at             bigint,
  status               text    not null default 'open'
                         check (status in ('open','resolved','void')),
  strike_sector        smallint check (strike_sector between 0 and 63),
  pot_lamports         bigint  not null default 0 check (pot_lamports >= 0),
  carried_lamports     bigint  not null default 0 check (carried_lamports >= 0),
  fee_accrued_lamports bigint  not null default 0 check (fee_accrued_lamports >= 0),
  treasury_lamports    bigint  not null default 0,
  migration_mint       text,
  mint_count           integer not null default 0,
  uptime_ratio         real    not null default 1,
  started_tz timestamptz generated always as (to_timestamp(started_at / 1000.0)) stored
);

-- At most one open round at a time.
create unique index if not exists rounds_single_open
  on public.rounds ((status)) where status = 'open';

create index if not exists rounds_status_idx on public.rounds (status, id desc);

-- ---------------------------------------------------------------------
-- mints — the live pump.fun launch feed, bucketed by sector
--
-- `counted` records whether the mint contributed to grade. The one-per-
-- creator-per-sector cap is stored rather than recomputed so it stays
-- auditable instead of invisible.
-- ---------------------------------------------------------------------
create table if not exists public.mints (
  mint        text primary key,
  sector      smallint not null check (sector between 0 and 63),
  round_id    bigint   not null references public.rounds(id) on delete cascade,
  received_at bigint   not null,
  name        text,
  symbol      text,
  uri         text,
  creator     text,
  counted     boolean  not null default true
);

create index if not exists mints_round_idx    on public.mints (round_id, received_at);
create index if not exists mints_recent_idx   on public.mints (received_at desc);
create index if not exists mints_sector_idx   on public.mints (sector);

-- ---------------------------------------------------------------------
-- migrations — bonding curve graduations
-- ---------------------------------------------------------------------
create table if not exists public.migrations (
  mint        text primary key,
  sector      smallint not null check (sector between 0 and 63),
  round_id    bigint   not null references public.rounds(id) on delete cascade,
  received_at bigint   not null
);

create index if not exists migrations_round_idx  on public.migrations (round_id);
create index if not exists migrations_recent_idx on public.migrations (received_at desc);

-- ---------------------------------------------------------------------
-- spots — a claimed sector
--
-- One LIVE spot per wallet, and one live spot per sector. Both are enforced
-- by partial unique indexes so released rows stay in history without
-- blocking a re-claim.
-- ---------------------------------------------------------------------
create table if not exists public.spots (
  id              bigserial primary key,
  wallet          text     not null,
  sector          smallint not null check (sector between 0 and 63),
  depth           integer  not null default 0 check (depth >= 0),
  tokens          numeric  not null default 0,
  status          text     not null default 'live' check (status in ('live','released')),
  claimed_round   bigint   not null,
  released_round  bigint,
  released_reason text,
  claimed_at      timestamptz not null default now()
);

create unique index if not exists spots_one_per_wallet
  on public.spots (wallet) where status = 'live';

create unique index if not exists spots_one_per_sector
  on public.spots (sector) where status = 'live';

create index if not exists spots_status_idx on public.spots (status);

-- ---------------------------------------------------------------------
-- payouts — the owed ledger
--
-- Rows are created as 'owed'. Settlement is manual: a row only becomes
-- 'paid' when a real transaction signature is attached to it. Nothing in
-- this schema can move funds.
-- ---------------------------------------------------------------------
create table if not exists public.payouts (
  id        bigserial primary key,
  round_id  bigint   not null references public.rounds(id) on delete cascade,
  wallet    text     not null,
  spot_id   bigint   references public.spots(id) on delete set null,
  kind      text     not null check (kind in ('strike','rift','pool')),
  lamports  bigint   not null check (lamports >= 0),
  status    text     not null default 'owed' check (status in ('owed','paid')),
  signature text,
  paid_at   timestamptz,
  unique (round_id, spot_id, kind)
);

create index if not exists payouts_status_idx on public.payouts (status);
create index if not exists payouts_wallet_idx on public.payouts (wallet, id desc);

-- A row marked paid must carry the signature that paid it.
alter table public.payouts drop constraint if exists payouts_paid_needs_signature;
alter table public.payouts add constraint payouts_paid_needs_signature
  check (status <> 'paid' or (signature is not null and paid_at is not null));

-- ---------------------------------------------------------------------
-- nonces — single-use, wallet-bound, five minute lifetime
-- ---------------------------------------------------------------------
create table if not exists public.nonces (
  nonce      text primary key,
  wallet     text        not null,
  created_at timestamptz not null default now(),
  used       boolean     not null default false
);

create index if not exists nonces_created_idx on public.nonces (created_at);

-- ---------------------------------------------------------------------
-- meta — internal runtime state (carried pot, last treasury mark)
-- ---------------------------------------------------------------------
create table if not exists public.meta (
  key   text primary key,
  value text not null
);

-- =====================================================================
-- Views
-- =====================================================================

-- What each wallet is currently owed.
create or replace view public.v_owed_by_wallet as
select
  wallet,
  sum(lamports)             as lamports,
  count(distinct round_id)  as rounds,
  min(round_id)             as since_round
from public.payouts
where status = 'owed' and lamports > 0
group by wallet
order by sum(lamports) desc;

-- Current state of all 64 sectors, including unclaimed ones.
create or replace view public.v_field as
select
  g.sector,
  s.wallet,
  s.id     as spot_id,
  s.depth,
  (s.id is not null)                                    as claimed,
  1 + least(coalesce(s.depth, 0), 36)::numeric / 18     as weight
from generate_series(0, 63) as g(sector)
left join public.spots s
  on s.sector = g.sector and s.status = 'live'
order by g.sector;

-- Per-wallet summary for the position page.
create or replace view public.v_wallet_summary as
select
  p.wallet,
  sum(p.lamports) filter (where p.status = 'owed') as owed_lamports,
  sum(p.lamports) filter (where p.status = 'paid') as paid_lamports,
  count(*)                                          as payout_rows
from public.payouts p
group by p.wallet;

-- =====================================================================
-- Row Level Security
--
-- Everything on this site is meant to be publicly auditable, so reads are
-- open. Writes are service-role only — the app writes with the service key
-- from the server, and an anon key can never insert a payout or a spot.
-- =====================================================================

alter table public.config     enable row level security;
alter table public.rounds     enable row level security;
alter table public.mints      enable row level security;
alter table public.migrations enable row level security;
alter table public.spots      enable row level security;
alter table public.payouts    enable row level security;
alter table public.nonces     enable row level security;
alter table public.meta       enable row level security;

do $$
declare t text;
begin
  -- Public read on everything a visitor should be able to verify.
  foreach t in array array['config','rounds','mints','migrations','spots','payouts']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format(
      'create policy %I on public.%I for select using (true)',
      t || '_public_read', t
    );
  end loop;
end $$;

-- nonces and meta stay private: nonces are auth material, meta is internal.
drop policy if exists nonces_no_public on public.nonces;
drop policy if exists meta_no_public   on public.meta;

-- =====================================================================
-- Housekeeping
-- =====================================================================

-- Nonces are worthless after five minutes. Schedule with pg_cron if you like:
--   select cron.schedule('nodei-nonce-gc', '*/15 * * * *', 'select public.gc_nonces()');
create or replace function public.gc_nonces() returns void
language sql security definer set search_path = public as $$
  delete from public.nonces where created_at < now() - interval '1 hour';
$$;

-- Convenience: mark every owed row for a wallet as settled by one signature.
-- This records a payment that has ALREADY been sent. It does not send one.
create or replace function public.mark_wallet_paid(p_wallet text, p_signature text)
returns integer
language sql security definer set search_path = public as $$
  with updated as (
    update public.payouts
       set status = 'paid', signature = p_signature, paid_at = now()
     where wallet = p_wallet and status = 'owed'
     returning 1
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.mark_wallet_paid(text, text) from public, anon, authenticated;
