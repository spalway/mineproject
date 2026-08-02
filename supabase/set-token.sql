-- =====================================================================
-- nodei — set the token contract address
--
-- Paste the mint between the quotes and run. That is the whole job.
-- Takes effect on the very next request: no redeploy, no restart.
--
-- Claiming stays CLOSED until this is set, which is deliberate — the gate
-- fails closed rather than open.
-- =====================================================================

insert into public.config (key, value)
values ('token_mint', 'PASTE_MINT_ADDRESS_HERE')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();


-- Check it took:
--   select key, value, updated_at from public.config where key = 'token_mint';


-- ---------------------------------------------------------------------
-- Everything below is optional. Uncomment only what you want to change.
-- ---------------------------------------------------------------------

-- Treasury wallet that receives creator fees. Round pots are measured from
-- this wallet's balance change, so changing it mid-flight resets the
-- baseline on the next close.
--
-- insert into public.config (key, value)
-- values ('treasury_address', 'PASTE_TREASURY_ADDRESS_HERE')
-- on conflict (key) do update
--   set value = excluded.value, updated_at = now();


-- Minimum token balance required to hold a sector.
--
-- insert into public.config (key, value)
-- values ('min_token_balance', '10000')
-- on conflict (key) do update
--   set value = excluded.value, updated_at = now();


-- Share of newly accrued creator fees that flows into each round pot,
-- in basis points. 7000 = 70%.
--
-- insert into public.config (key, value)
-- values ('fee_share_bps', '7000')
-- on conflict (key) do update
--   set value = excluded.value, updated_at = now();


-- Kill switch: set to 'false' to stop new claims without taking the site
-- down. Existing sectors keep earning.
--
-- insert into public.config (key, value)
-- values ('claims_open', 'false')
-- on conflict (key) do update
--   set value = excluded.value, updated_at = now();


-- To clear the token again and close claiming:
--   update public.config set value = '', updated_at = now() where key = 'token_mint';
