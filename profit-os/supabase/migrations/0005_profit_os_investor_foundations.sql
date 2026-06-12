-- PROFIT OS — investor layer foundations (applied as `profit_os_investor_foundations`)
-- churn, financing (debt), CAPEX

-- Churn: monthly cancellations per club
alter table public.profit_monthly_entries
  add column cancellations integer not null default 0;

-- Debt: interest goes to the P&L (between EBIT and tax),
-- principal repayment goes to cash flow only, never to the P&L.
-- French annuity (constant payment) computed client-side from these terms.
create table public.profit_financing (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  label text not null,
  principal numeric not null check (principal > 0),
  annual_rate numeric not null default 0 check (annual_rate >= 0), -- percent
  term_months integer not null check (term_months > 0),
  start_date date not null,
  created_at timestamptz not null default now()
);

-- CAPEX: acquisition price, fit-out, machines. Feeds P&L amortization
-- automatically (amount / amort_months while active); cash out at purchase month
create table public.profit_capex (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  label text not null,
  amount numeric not null check (amount > 0),
  date date not null,
  amort_months integer not null default 60 check (amort_months > 0),
  created_at timestamptz not null default now()
);

create index profit_financing_club_idx on public.profit_financing (club_id);
create index profit_capex_club_idx on public.profit_capex (club_id);

alter table public.profit_financing enable row level security;
alter table public.profit_capex enable row level security;

create policy financing_select on public.profit_financing
  for select using (public.my_profit_role() is not null);
create policy financing_write on public.profit_financing
  for all using (public.my_profit_role() in ('owner','member'))
  with check (public.my_profit_role() in ('owner','member'));

create policy capex_select on public.profit_capex
  for select using (public.my_profit_role() is not null);
create policy capex_write on public.profit_capex
  for all using (public.my_profit_role() in ('owner','member'))
  with check (public.my_profit_role() in ('owner','member'));

revoke all on public.profit_financing, public.profit_capex from anon;

-- ——— Seeds Versoix ———
-- Churn: April 7 cancellations (churn 3.33% -> implied duration 30 months,
-- matches configured), May 13 (consistent roll-forward: 210 + 31 - 13 = 228)
update public.profit_monthly_entries set cancellations = 7
where club_id = '36e06074-f9e6-404c-a81b-ec4350ad76f0' and month = '2026-04-01';
update public.profit_monthly_entries set cancellations = 13
where club_id = '36e06074-f9e6-404c-a81b-ec4350ad76f0' and month = '2026-05-01';

-- CAPEX: the 180k machines move from club settings into profit_capex
-- (single source of truth), plus the club acquisition & fit-out
insert into public.profit_capex (club_id, label, amount, date, amort_months) values
  ('36e06074-f9e6-404c-a81b-ec4350ad76f0', 'Acquisition & fit-out club', 250000, '2026-01-01', 120),
  ('36e06074-f9e6-404c-a81b-ec4350ad76f0', 'Machines & équipement', 180000, '2026-01-01', 60);

update public.profit_club_settings set equipment_value = 0
where club_id = '36e06074-f9e6-404c-a81b-ec4350ad76f0';

-- Financing: bank loan for the acquisition (French annuity)
insert into public.profit_financing (club_id, label, principal, annual_rate, term_months, start_date) values
  ('36e06074-f9e6-404c-a81b-ec4350ad76f0', 'Prêt bancaire acquisition', 300000, 4.5, 84, '2026-01-01');
