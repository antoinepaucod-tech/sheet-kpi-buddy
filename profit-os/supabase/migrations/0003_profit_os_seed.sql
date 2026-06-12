-- PROFIT OS — seed (already applied to project tnmpphysbtoezzjfqxcd)
-- Roles for the 3 existing Tasks OS test users (password Test1234!)
insert into public.profit_members (user_id, role) values
  ('cc136366-eace-4f1a-a6de-551141192835', 'owner'),   -- antoine.owner@test.local
  ('d418a43b-ecd8-4ee3-94fd-7015565e6ecc', 'member'),  -- coach1.member@test.local
  ('fbab4133-b5bd-4bb2-ac40-84787eba882c', 'viewer')   -- coach2.viewer@test.local
on conflict (user_id) do nothing;

-- Default settings for the 4 group clubs
insert into public.profit_club_settings (club_id, avg_membership_months, default_arpu, equipment_value, equipment_amort_months, currency)
select c.id, 30, 159, 0, 60, 'CHF'
from public.clubs c
where c.organization_id = '30400627-1288-4011-bc72-267b8f46b80c'
on conflict (club_id) do nothing;

-- Versoix: equipment 180k amortized over 60 months -> 3000/month smoothed charge
update public.profit_club_settings
set equipment_value = 180000, equipment_amort_months = 60
where club_id = '36e06074-f9e6-404c-a81b-ec4350ad76f0';

-- 2 months of demo data for Hybrid Gym Versoix
insert into public.profit_monthly_entries (
  club_id, month,
  ad_spend, agency_fees, video_fees, leads_generated, new_members,
  staff_cost, rent, cleaning, insurance, energy, misc_opex,
  active_members, arpu, revenue_pt, revenue_shop, revenue_dropin,
  created_by
) values
  ('36e06074-f9e6-404c-a81b-ec4350ad76f0', '2026-04-01',
   3500, 1200, 800, 120, 24,
   18000, 6500, 900, 450, 1100, 600,
   210, 159, 4200, 850, 600,
   'cc136366-eace-4f1a-a6de-551141192835'),
  ('36e06074-f9e6-404c-a81b-ec4350ad76f0', '2026-05-01',
   4200, 1200, 0, 145, 31,
   18200, 6500, 900, 450, 950, 400,
   228, 159, 4800, 920, 740,
   'cc136366-eace-4f1a-a6de-551141192835')
on conflict (club_id, month) do nothing;

-- One demo scenario (loadable from the simulator)
insert into public.profit_scenarios (name, club_id, data, created_by)
values ('Versoix +20% membres', '36e06074-f9e6-404c-a81b-ec4350ad76f0',
  '{"active_members":274,"arpu":159,"avg_membership_months":30,"ad_spend":4200,"agency_fees":1200,"video_fees":0,"leads_generated":170,"new_members":38,"staff_cost":18200,"rent":6500,"cleaning":900,"insurance":450,"energy":950,"misc_opex":400,"equipment_amort_override":3000,"revenue_pt":4800,"revenue_shop":920,"revenue_dropin":740,"base_month":"2026-05"}'::jsonb,
  'cc136366-eace-4f1a-a6de-551141192835')
on conflict do nothing;
