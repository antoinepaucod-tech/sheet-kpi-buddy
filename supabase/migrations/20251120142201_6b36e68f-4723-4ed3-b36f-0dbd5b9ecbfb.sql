-- Le trigger doit compter les TRANSACTIONS de revenus membres dans la comptabilité
-- pas les membres actifs dans customer_members

CREATE OR REPLACE FUNCTION public.sync_members_to_monthly_kpis()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_year INTEGER;
  affected_month INTEGER;
  affected_month_name TEXT;
  general_count INTEGER;
  pt_count INTEGER;
  pif_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Determine affected year/month from the transaction
  IF TG_OP = 'DELETE' THEN
    affected_year := OLD.year;
    affected_month := OLD.month;
    affected_month_name := OLD.month_name;
  ELSE
    affected_year := NEW.year;
    affected_month := NEW.month;
    affected_month_name := NEW.month_name;
  END IF;

  -- Count TRANSACTIONS by member type from accounting_transactions
  -- for this specific month and year
  SELECT 
    COUNT(CASE WHEN product_description = 'Revenu EFT Général' THEN 1 END),
    COUNT(CASE WHEN product_description = 'Revenu PT' THEN 1 END),
    COUNT(CASE WHEN product_description = 'Membre PIF' THEN 1 END)
  INTO general_count, pt_count, pif_count
  FROM accounting_transactions
  WHERE transaction_type = 'revenue'
    AND year = affected_year
    AND month = affected_month
    AND product_description IN ('Revenu EFT Général', 'Revenu PT', 'Membre PIF');

  -- Calculate total
  total_count := general_count + pt_count + pif_count;

  -- Upsert into monthly_kpis for the transaction's month
  INSERT INTO monthly_kpis (year, month, month_name, recurring_general_members, pt_members, pif_members, total_active_members)
  VALUES (
    affected_year,
    affected_month,
    affected_month_name,
    general_count,
    pt_count,
    pif_count,
    total_count
  )
  ON CONFLICT (year, month)
  DO UPDATE SET 
    recurring_general_members = EXCLUDED.recurring_general_members,
    pt_members = EXCLUDED.pt_members,
    pif_members = EXCLUDED.pif_members,
    total_active_members = EXCLUDED.total_active_members;

  RETURN COALESCE(NEW, OLD);
END;
$function$;