-- The Simulator now saves { ...sim, base_month } where sim includes `interest`
-- (debt slider, investor layer) and `cancellations` (from EMPTY_ENTRY).
-- The demo scenario predates both; load() backfills them from SIM_DEFAULTS so it
-- was already compatible — this just brings the seed to the exact current shape.
-- Idempotent: existing keys win (`data` is on the right of ||).
update public.profit_scenarios
set data = jsonb_build_object('interest', 0, 'cancellations', 0) || data
where name = 'Versoix +20% membres';
