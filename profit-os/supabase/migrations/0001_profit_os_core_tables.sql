-- PROFIT OS — core tables (applied on project tnmpphysbtoezzjfqxcd as `profit_os_core_tables`)
create table public.profit_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member','viewer')),
  created_at timestamptz not null default now()
);

create table public.profit_club_settings (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  avg_membership_months numeric not null default 30 check (avg_membership_months > 0),
  default_arpu numeric not null default 0 check (default_arpu >= 0),
  equipment_value numeric not null default 0 check (equipment_value >= 0),
  equipment_amort_months integer not null default 60 check (equipment_amort_months > 0),
  currency text not null default 'CHF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profit_monthly_entries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  -- acquisition
  ad_spend numeric not null default 0,
  agency_fees numeric not null default 0,
  video_fees numeric not null default 0,
  leads_generated integer not null default 0,
  new_members integer not null default 0,
  -- opex (equipment amortization is derived from settings unless overridden)
  staff_cost numeric not null default 0,
  rent numeric not null default 0,
  cleaning numeric not null default 0,
  insurance numeric not null default 0,
  energy numeric not null default 0,
  misc_opex numeric not null default 0,
  equipment_amort_override numeric,
  -- revenue
  active_members integer not null default 0,
  arpu numeric, -- null = use club default_arpu
  revenue_pt numeric not null default 0,
  revenue_shop numeric not null default 0,
  revenue_dropin numeric not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, month)
);

create table public.profit_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  club_id uuid references public.clubs(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profit_entries_club_month_idx on public.profit_monthly_entries (club_id, month desc);
create index profit_scenarios_club_idx on public.profit_scenarios (club_id);

create or replace function public.profit_set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profit_settings_updated before update on public.profit_club_settings
  for each row execute function public.profit_set_updated_at();
create trigger profit_entries_updated before update on public.profit_monthly_entries
  for each row execute function public.profit_set_updated_at();
create trigger profit_scenarios_updated before update on public.profit_scenarios
  for each row execute function public.profit_set_updated_at();
