-- Fix member KPI counts based on accounting_transactions and clean obsolete trigger

-- 1) Drop old trigger on customer_members that no longer matches the new logic
DROP TRIGGER IF EXISTS sync_members_trigger ON public.customer_members;

-- 2) Recalculate member counts (recurring_general_members, pt_members, pif_members, total_active_members)
--    in monthly_kpis from existing accounting_transactions data

WITH member_counts AS (
  SELECT 
    year,
    month,
    MIN(month_name) AS month_name,
    COUNT(CASE WHEN product_description = 'Revenu EFT Général' THEN 1 END) AS recurring_general_members,
    COUNT(CASE WHEN product_description = 'Revenu PT' THEN 1 END) AS pt_members,
    COUNT(CASE WHEN product_description = 'Membre PIF' THEN 1 END) AS pif_members
  FROM accounting_transactions
  WHERE transaction_type = 'revenue'
  GROUP BY year, month
),
member_totals AS (
  SELECT
    year,
    month,
    month_name,
    recurring_general_members,
    pt_members,
    pif_members,
    (recurring_general_members + pt_members + pif_members) AS total_active_members
  FROM member_counts
)
INSERT INTO monthly_kpis (
  year,
  month,
  month_name,
  recurring_general_members,
  pt_members,
  pif_members,
  total_active_members
)
SELECT
  year,
  month,
  month_name,
  recurring_general_members,
  pt_members,
  pif_members,
  total_active_members
FROM member_totals
ON CONFLICT (year, month)
DO UPDATE SET
  recurring_general_members = EXCLUDED.recurring_general_members,
  pt_members = EXCLUDED.pt_members,
  pif_members = EXCLUDED.pif_members,
  total_active_members = EXCLUDED.total_active_members;

-- 3) For months without any revenue transactions, force member KPIs to zero
UPDATE monthly_kpis mk
SET 
  recurring_general_members = 0,
  pt_members = 0,
  pif_members = 0,
  total_active_members = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM accounting_transactions at
  WHERE at.transaction_type = 'revenue'
    AND at.year = mk.year
    AND at.month = mk.month
);