-- =====================================================================
-- nodei — runtime helper functions
--
-- Run this if you provisioned from an earlier schema.sql. Safe to re-run.
--
-- These are the operations PostgREST cannot express in a single call: a bulk
-- read-modify-write on depth, ledger totals, and an atomic claim. The app has
-- fallbacks for all three, so it works without them — but the fallbacks cost
-- one request per spot, so run this.
-- =====================================================================

create or replace function public.nodei_bump_depth(p_ids bigint[])
returns void
language sql security definer set search_path = public as $$
  update public.spots set depth = depth + 1 where id = any(p_ids);
$$;

create or replace function public.nodei_totals()
returns table (owed bigint, paid bigint)
language sql security definer set search_path = public as $$
  select
    coalesce(sum(lamports) filter (where status = 'owed'), 0)::bigint,
    coalesce(sum(lamports) filter (where status = 'paid'), 0)::bigint
  from public.payouts;
$$;

-- The partial unique indexes already prevent a double claim; doing it in one
-- statement closes the gap between "is it free" and "take it".
create or replace function public.nodei_claim_spot(
  p_wallet text,
  p_sector smallint,
  p_tokens numeric,
  p_round bigint
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  insert into public.spots (wallet, sector, tokens, claimed_round)
  values (p_wallet, p_sector, p_tokens, p_round)
  returning id into new_id;
  return new_id;
end $$;

revoke all on function public.nodei_bump_depth(bigint[]) from public, anon, authenticated;
revoke all on function public.nodei_totals() from public, anon, authenticated;
revoke all on function public.nodei_claim_spot(text, smallint, numeric, bigint)
  from public, anon, authenticated;

-- PostgREST caches the schema. New functions are picked up automatically, but
-- this makes it immediate.
notify pgrst, 'reload schema';

-- Confirm:
--   select proname from pg_proc where proname like 'nodei_%';
