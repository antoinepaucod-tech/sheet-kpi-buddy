-- PROFIT OS — Swiss fiscal layer (applied as `profit_os_swiss_fiscal`)
-- Rates stored in percent (8.1 = 8.1%).
-- VAT: revenues are entered TTC, the P&L is computed in HT (TTC / (1 + vat)).
-- Employer social charges: applied on top of gross salaries.
-- Profit tax: per club, applied on EBIT only when EBIT > 0.
alter table public.profit_club_settings
  add column vat_rate numeric not null default 8.1 check (vat_rate >= 0),
  add column employer_charges_rate numeric not null default 17 check (employer_charges_rate >= 0),
  add column profit_tax_rate numeric not null default 14 check (profit_tax_rate >= 0);

-- Lausanne is in Vaud -> 13.8%; the three Geneva clubs keep the 14% default
update public.profit_club_settings
set profit_tax_rate = 13.8
where club_id = '60197ffa-fcff-4ee8-8313-baf7902d93eb';

-- Demo seeds update: with the fiscal layer, ARPU 159 TTC left Versoix barely at
-- break-even; demo ARPU moves to 179 TTC for a readable P&L.
update public.profit_club_settings set default_arpu = 179
where club_id in (select id from public.clubs where organization_id = '30400627-1288-4011-bc72-267b8f46b80c');

update public.profit_monthly_entries set arpu = 179
where club_id = '36e06074-f9e6-404c-a81b-ec4350ad76f0';

update public.profit_scenarios
set data = data || '{"arpu":179,"vat_rate":8.1,"employer_charges_rate":17,"profit_tax_rate":14}'::jsonb
where name = 'Versoix +20% membres';
