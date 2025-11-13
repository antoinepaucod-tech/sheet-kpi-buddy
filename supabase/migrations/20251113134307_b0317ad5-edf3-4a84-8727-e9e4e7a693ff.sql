-- Fix KPI revenue to use amount_received (cash) instead of amount
-- 1) Drop existing revenue trigger and function if they exist
DROP TRIGGER IF EXISTS sync_revenue_trigger ON public.accounting_transactions;
DROP FUNCTION IF EXISTS public.sync_revenue_to_monthly_kpis();

-- 2) Recreate function using amount_received for categories and total
CREATE OR REPLACE FUNCTION public.sync_revenue_to_monthly_kpis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Calculate revenue by specific product_description using amount_received (EXCLUDING 'Membre PIF')
  SELECT 
    COALESCE(SUM(CASE WHEN product_description = 'Revenu EFT Général' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN product_description = 'Revenu PT' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN product_description = 'Revenu Retail' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN product_description = 'Revenu Fast Cash' THEN amount_received ELSE 0 END), 0)
  INTO general_eft, pt_rev, retail_rev, fast_cash
  FROM public.accounting_transactions
  WHERE transaction_type = 'revenue'
    AND year = affected_year
    AND month = affected_month
    AND product_description != 'Membre PIF';

  -- Calculate total revenue INCLUDING Membre PIF (all revenue transactions) using amount_received
  SELECT COALESCE(SUM(amount_received), 0)
  INTO total_rev
  FROM public.accounting_transactions
  WHERE transaction_type = 'revenue'
    AND year = affected_year
    AND month = affected_month;

  -- Upsert into monthly_kpis
  INSERT INTO public.monthly_kpis (year, month, month_name, general_eft_revenue, pt_revenue, retail_revenue, fast_cash_revenue, total_revenue)
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

-- 3) Recreate trigger to keep monthly_kpis in sync on revenue changes
CREATE TRIGGER sync_revenue_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.accounting_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_revenue_to_monthly_kpis();

-- 4) Initial backfill to correct existing data for all months using amount_received
WITH revenue_by_month AS (
  SELECT 
    year,
    month,
    month_name,
    COALESCE(SUM(CASE WHEN product_description = 'Revenu EFT Général' THEN amount_received ELSE 0 END), 0) AS general_eft,
    COALESCE(SUM(CASE WHEN product_description = 'Revenu PT' THEN amount_received ELSE 0 END), 0) AS pt_rev,
    COALESCE(SUM(CASE WHEN product_description = 'Revenu Retail' THEN amount_received ELSE 0 END), 0) AS retail_rev,
    COALESCE(SUM(CASE WHEN product_description = 'Revenu Fast Cash' THEN amount_received ELSE 0 END), 0) AS fast_cash,
    COALESCE(SUM(amount_received), 0) AS total_rev
  FROM public.accounting_transactions
  WHERE transaction_type = 'revenue'
  GROUP BY year, month, month_name
)
INSERT INTO public.monthly_kpis (year, month, month_name, general_eft_revenue, pt_revenue, retail_revenue, fast_cash_revenue, total_revenue)
SELECT year, month, month_name, general_eft, pt_rev, retail_rev, fast_cash, total_rev
FROM revenue_by_month
ON CONFLICT (year, month)
DO UPDATE SET
  general_eft_revenue = EXCLUDED.general_eft_revenue,
  pt_revenue = EXCLUDED.pt_revenue,
  retail_revenue = EXCLUDED.retail_revenue,
  fast_cash_revenue = EXCLUDED.fast_cash_revenue,
  total_revenue = EXCLUDED.total_revenue;

-- 5) Ensure profit is consistent after backfill
UPDATE public.monthly_kpis
SET profit = COALESCE(total_revenue, 0) - COALESCE(total_expenses, 0);
