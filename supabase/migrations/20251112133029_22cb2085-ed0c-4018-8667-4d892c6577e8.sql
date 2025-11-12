-- Function to sync revenue types from accounting_transactions to monthly_kpis
CREATE OR REPLACE FUNCTION sync_revenue_to_monthly_kpis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_year INTEGER;
  affected_month INTEGER;
  affected_month_name TEXT;
  general_eft NUMERIC;
  pt_rev NUMERIC;
  retail_rev NUMERIC;
  fast_cash NUMERIC;
  total_rev NUMERIC;
BEGIN
  -- Determine affected year/month
  IF TG_OP = 'DELETE' THEN
    IF OLD.transaction_type != 'revenue' THEN
      RETURN OLD;
    END IF;
    affected_year := OLD.year;
    affected_month := OLD.month;
    affected_month_name := OLD.month_name;
  ELSE
    IF NEW.transaction_type != 'revenue' THEN
      RETURN NEW;
    END IF;
    affected_year := NEW.year;
    affected_month := NEW.month;
    affected_month_name := NEW.month_name;
  END IF;

  -- Calculate revenue by product_description
  SELECT 
    COALESCE(SUM(CASE WHEN product_description = 'Revenu EFT Général' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN product_description = 'Revenu PT' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN product_description = 'Revenu Retail' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN product_description = 'Revenu Fast Cash' THEN amount ELSE 0 END), 0)
  INTO general_eft, pt_rev, retail_rev, fast_cash
  FROM accounting_transactions
  WHERE transaction_type = 'revenue'
    AND year = affected_year
    AND month = affected_month;

  -- Calculate total revenue
  total_rev := general_eft + pt_rev + retail_rev + fast_cash;

  -- Upsert into monthly_kpis
  INSERT INTO monthly_kpis (year, month, month_name, general_eft_revenue, pt_revenue, retail_revenue, fast_cash_revenue, total_revenue)
  VALUES (
    affected_year,
    affected_month,
    affected_month_name,
    general_eft,
    pt_rev,
    retail_rev,
    fast_cash,
    total_rev
  )
  ON CONFLICT (year, month)
  DO UPDATE SET 
    general_eft_revenue = EXCLUDED.general_eft_revenue,
    pt_revenue = EXCLUDED.pt_revenue,
    retail_revenue = EXCLUDED.retail_revenue,
    fast_cash_revenue = EXCLUDED.fast_cash_revenue,
    total_revenue = EXCLUDED.total_revenue;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for revenue sync
DROP TRIGGER IF EXISTS sync_revenue_trigger ON accounting_transactions;
CREATE TRIGGER sync_revenue_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_transactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_revenue_to_monthly_kpis();

-- Function to sync member counts from customer_members to monthly_kpis
CREATE OR REPLACE FUNCTION sync_members_to_monthly_kpis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Upsert into monthly_kpis
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
$$;

-- Create trigger for member count sync
DROP TRIGGER IF EXISTS sync_members_trigger ON customer_members;
CREATE TRIGGER sync_members_trigger
  AFTER INSERT OR UPDATE OR DELETE ON customer_members
  FOR EACH ROW
  EXECUTE FUNCTION sync_members_to_monthly_kpis();

-- Initial sync for existing revenue data
INSERT INTO monthly_kpis (year, month, month_name, general_eft_revenue, pt_revenue, retail_revenue, fast_cash_revenue, total_revenue)
SELECT 
  year,
  month,
  month_name,
  SUM(CASE WHEN product_description = 'Revenu EFT Général' THEN amount ELSE 0 END) as general_eft,
  SUM(CASE WHEN product_description = 'Revenu PT' THEN amount ELSE 0 END) as pt_rev,
  SUM(CASE WHEN product_description = 'Revenu Retail' THEN amount ELSE 0 END) as retail_rev,
  SUM(CASE WHEN product_description = 'Revenu Fast Cash' THEN amount ELSE 0 END) as fast_cash,
  SUM(amount) as total_rev
FROM accounting_transactions
WHERE transaction_type = 'revenue'
GROUP BY year, month, month_name
ON CONFLICT (year, month)
DO UPDATE SET 
  general_eft_revenue = EXCLUDED.general_eft_revenue,
  pt_revenue = EXCLUDED.pt_revenue,
  retail_revenue = EXCLUDED.retail_revenue,
  fast_cash_revenue = EXCLUDED.fast_cash_revenue,
  total_revenue = EXCLUDED.total_revenue;

-- Initial sync for existing member data (current month only)
DO $$
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

  -- Insert or update
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
END $$;