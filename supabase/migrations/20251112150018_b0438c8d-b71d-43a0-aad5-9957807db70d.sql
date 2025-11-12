-- Update sync_revenue_to_monthly_kpis to exclude 'Membre PIF' from revenue calculations
-- Members PIF should only appear in cash_collected, not in revenue columns
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

  -- Calculate revenue by product_description (EXCLUDING 'Membre PIF')
  -- Membre PIF should only count in cash_collected, not in revenue columns
  SELECT 
    COALESCE(SUM(CASE WHEN product_description = 'Revenu EFT Général' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN product_description = 'Revenu PT' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN product_description = 'Revenu Retail' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN product_description = 'Revenu Fast Cash' THEN amount ELSE 0 END), 0)
  INTO general_eft, pt_rev, retail_rev, fast_cash
  FROM accounting_transactions
  WHERE transaction_type = 'revenue'
    AND year = affected_year
    AND month = affected_month
    AND product_description != 'Membre PIF';

  -- Calculate total revenue (excluding Membre PIF)
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