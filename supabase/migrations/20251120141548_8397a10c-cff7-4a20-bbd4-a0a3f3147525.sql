-- Drop the old trigger that was based on customer_members changes
DROP TRIGGER IF EXISTS sync_members_to_monthly_kpis_trigger ON public.customer_members;

-- Create new trigger that runs on accounting_transactions instead
-- This way we can synchronize members to the correct month (transaction month, not current month)
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
  month_names TEXT[] := ARRAY['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  month_start_date DATE;
  month_end_date DATE;
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

  -- Calculate the start and end of the month
  month_start_date := make_date(affected_year, affected_month, 1);
  month_end_date := (month_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Count active members by type FOR THE SPECIFIC MONTH
  -- A member is active in a month if:
  -- - contract_signed_date <= end of month
  -- - (exit_date IS NULL OR exit_date > start of month)
  SELECT 
    COUNT(CASE WHEN member_type = 'Membres Généraux Récurrents' THEN 1 END),
    COUNT(CASE WHEN member_type = 'Membres PT' THEN 1 END),
    COUNT(CASE WHEN member_type = 'Membres PIF' THEN 1 END)
  INTO general_count, pt_count, pif_count
  FROM customer_members
  WHERE (contract_signed_date IS NULL OR contract_signed_date <= month_end_date)
    AND (exit_date IS NULL OR exit_date > month_start_date);

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

-- Create trigger on accounting_transactions instead of customer_members
CREATE TRIGGER sync_members_to_monthly_kpis_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.accounting_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_members_to_monthly_kpis();