-- PROFIT OS — investor dashboard (applied as `profit_os_investor_dashboard`)
-- surface & capacity for per-m²/occupancy metrics, EBITDA multiple for valuation
alter table public.profit_club_settings
  add column surface_m2 numeric not null default 0 check (surface_m2 >= 0),
  add column max_capacity integer not null default 0 check (max_capacity >= 0),
  add column ebitda_multiple numeric not null default 5 check (ebitda_multiple >= 0);

-- Seeds: plausible Swiss gym footprints; multiple stays at the 5x default
update public.profit_club_settings set surface_m2 = 650, max_capacity = 350
where club_id = '36e06074-f9e6-404c-a81b-ec4350ad76f0'; -- Versoix
update public.profit_club_settings set surface_m2 = 800, max_capacity = 450
where club_id = 'e7e40bd1-2be4-47f8-a550-516c98198e48'; -- La Servette
update public.profit_club_settings set surface_m2 = 550, max_capacity = 300
where club_id = '50b2ecda-fd4f-4e7e-b971-1a0d9c0d7fe0'; -- Grand-Saconnex
update public.profit_club_settings set surface_m2 = 700, max_capacity = 400
where club_id = '60197ffa-fcff-4ee8-8313-baf7902d93eb'; -- Lausanne
