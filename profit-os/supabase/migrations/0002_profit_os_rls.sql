-- PROFIT OS — RLS via SECURITY DEFINER helpers (no recursive subqueries in policies)
-- Final state after `profit_os_rls` + `profit_os_hardening` migrations.

-- Caller can only ever read their OWN role. SECURITY DEFINER bypasses RLS on
-- profit_members inside the function, which is what prevents policy recursion.
create or replace function public.my_profit_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profit_members where user_id = auth.uid()
$$;

revoke all on function public.my_profit_role() from public, anon;
grant execute on function public.my_profit_role() to authenticated;

-- Club list for Profit OS: the 4 group clubs only (organization THE COACH group).
-- SECURITY DEFINER so Profit OS users don't need a policy on the shared clubs table.
create or replace function public.profit_clubs()
returns table (id uuid, name text, slug text, city text, color text)
language sql stable security definer
set search_path = public
as $$
  select c.id, c.name, c.slug, c.city, c.color
  from public.clubs c
  where c.organization_id = '30400627-1288-4011-bc72-267b8f46b80c'::uuid
    and public.my_profit_role() is not null
  order by c.name
$$;

revoke all on function public.profit_clubs() from public, anon;
grant execute on function public.profit_clubs() to authenticated;

alter table public.profit_members enable row level security;
alter table public.profit_club_settings enable row level security;
alter table public.profit_monthly_entries enable row level security;
alter table public.profit_scenarios enable row level security;

create policy members_select on public.profit_members
  for select using (user_id = auth.uid() or public.my_profit_role() = 'owner');
create policy members_write on public.profit_members
  for all using (public.my_profit_role() = 'owner')
  with check (public.my_profit_role() = 'owner');

create policy settings_select on public.profit_club_settings
  for select using (public.my_profit_role() is not null);
create policy settings_write on public.profit_club_settings
  for all using (public.my_profit_role() in ('owner','member'))
  with check (public.my_profit_role() in ('owner','member'));

create policy entries_select on public.profit_monthly_entries
  for select using (public.my_profit_role() is not null);
create policy entries_write on public.profit_monthly_entries
  for all using (public.my_profit_role() in ('owner','member'))
  with check (public.my_profit_role() in ('owner','member'));

create policy scenarios_select on public.profit_scenarios
  for select using (public.my_profit_role() is not null);
create policy scenarios_write on public.profit_scenarios
  for all using (public.my_profit_role() in ('owner','member'))
  with check (public.my_profit_role() in ('owner','member'));

revoke all on public.profit_members, public.profit_club_settings,
  public.profit_monthly_entries, public.profit_scenarios from anon;
