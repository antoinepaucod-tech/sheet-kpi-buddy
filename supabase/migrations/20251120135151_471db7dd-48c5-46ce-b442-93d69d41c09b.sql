CREATE OR REPLACE FUNCTION public.sync_members_to_monthly_kpis()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_year INTEGER;
  current_month INTEGER;
  current_month_name TEXT;
  general_count INTEGER;
  pt_count INTEGER;
  pif_count INTEGER;
  total_count INTEGER;
  month_names TEXT[] := ARRAY['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
BEGIN
  -- Get current month info
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  current_month_name := month_names[current_month];

  -- NEW RULE: only synchronise members for months that have at least one accounting transaction
  IF NOT EXISTS (
    SELECT 1
    FROM accounting_transactions
    WHERE year = current_year
      AND month = current_month
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Count active members by type
  SELECT 
    COUNT(CASE WHEN member_type = 'Membres Généraux Récurrents' THEN 1 END),
    COUNT(CASE WHEN member_type = 'Membres PT' THEN 1 END),
    COUNT(CASE WHEN member_type = 'Membres PIF' THEN 1 END)
  INTO general_count, pt_count, pif_count
  FROM customer_members
  WHERE exit_date IS NULL OR exit_date > CURRENT_DATE;

  -- Calculate total
  total_count := general_count + pt_count + pif_count;

  -- Upsert into monthly_kpis ONLY when the month exists in accounting
  INSERT INTO monthly_kpis (year, month, month_name, recurring_general_members, pt_members, pif_members, total_active_members)
  VALUES (
    current_year,
    current_month,
    current_month_name,
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