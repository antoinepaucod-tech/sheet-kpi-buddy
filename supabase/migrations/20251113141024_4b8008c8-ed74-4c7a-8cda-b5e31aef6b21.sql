-- Add separate column for coach salaries and fix sync to avoid duplication
-- 1) Add column salaries_coach if not exists
ALTER TABLE public.monthly_kpis
ADD COLUMN IF NOT EXISTS salaries_coach numeric NULL DEFAULT 0;

-- 2) Replace sync function to populate both salaries (admin) and salaries_coach (coach)
DROP TRIGGER IF EXISTS sync_expenses_trigger ON public.accounting_transactions;
DROP FUNCTION IF EXISTS public.sync_expenses_to_monthly_kpis();

CREATE OR REPLACE FUNCTION public.sync_expenses_to_monthly_kpis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_year INTEGER;
  affected_month INTEGER;
  affected_month_name TEXT;
  expense_ad_spend NUMERIC;
  expense_rent NUMERIC;
  expense_software NUMERIC;
  expense_internet NUMERIC;
  expense_subscriptions NUMERIC;
  expense_bank NUMERIC;
  expense_salaries NUMERIC;
  expense_salaries_coach NUMERIC;
  expense_food NUMERIC;
  expense_credit NUMERIC;
  total_exp NUMERIC;
BEGIN
  -- Determine affected year/month
  IF TG_OP = 'DELETE' THEN
    IF OLD.transaction_type != 'expense' THEN
      RETURN OLD;
    END IF;
    affected_year := OLD.year;
    affected_month := OLD.month;
    affected_month_name := OLD.month_name;
  ELSE
    IF NEW.transaction_type != 'expense' THEN
      RETURN NEW;
    END IF;
    affected_year := NEW.year;
    affected_month := NEW.month;
    affected_month_name := NEW.month_name;
  END IF;

  -- Calculate expenses per category
  SELECT 
    COALESCE(SUM(CASE WHEN category = 'PUBLICITÉ' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'LOYERS' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'LOGICIELS' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'TELEPHONIE' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'ABONNEMENTS' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'RETRAIT BANCOMAT' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'SALAIRES' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'SALAIRES COACH' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'ALIMENTAIRE' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'REMBOURSEMENT PRÊT' THEN amount ELSE 0 END), 0)
  INTO 
    expense_ad_spend,
    expense_rent,
    expense_software,
    expense_internet,
    expense_subscriptions,
    expense_bank,
    expense_salaries,
    expense_salaries_coach,
    expense_food,
    expense_credit
  FROM public.accounting_transactions
  WHERE transaction_type = 'expense'
    AND year = affected_year
    AND month = affected_month;

  -- Total expenses include both salary types
  total_exp := expense_ad_spend + expense_rent + expense_software + expense_internet + 
               expense_subscriptions + expense_bank + expense_salaries + expense_salaries_coach +
               expense_food + expense_credit;

  -- Upsert both salaries and salaries_coach separately
  INSERT INTO public.monthly_kpis (
    year, month, month_name,
    ad_spend, rent, computer_software, internet_telephone,
    subscriptions, bank_finance_charges, salaries, salaries_coach, food_expenses, credit_repayment,
    total_expenses
  )
  VALUES (
    affected_year,
    affected_month,
    affected_month_name,
    expense_ad_spend,
    expense_rent,
    expense_software,
    expense_internet,
    expense_subscriptions,
    expense_bank,
    expense_salaries,
    expense_salaries_coach,
    expense_food,
    expense_credit,
    total_exp
  )
  ON CONFLICT (year, month)
  DO UPDATE SET
    ad_spend = EXCLUDED.ad_spend,
    rent = EXCLUDED.rent,
    computer_software = EXCLUDED.computer_software,
    internet_telephone = EXCLUDED.internet_telephone,
    subscriptions = EXCLUDED.subscriptions,
    bank_finance_charges = EXCLUDED.bank_finance_charges,
    salaries = EXCLUDED.salaries,
    salaries_coach = EXCLUDED.salaries_coach,
    food_expenses = EXCLUDED.food_expenses,
    credit_repayment = EXCLUDED.credit_repayment,
    total_expenses = EXCLUDED.total_expenses;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) Recreate trigger
CREATE TRIGGER sync_expenses_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.accounting_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_expenses_to_monthly_kpis();

-- 4) Backfill existing months with both salaries values
INSERT INTO public.monthly_kpis (
  year, month, month_name,
  ad_spend, rent, computer_software, internet_telephone,
  subscriptions, bank_finance_charges, salaries, salaries_coach, food_expenses, credit_repayment,
  total_expenses
)
SELECT 
  year, month, month_name,
  SUM(CASE WHEN category = 'PUBLICITÉ' THEN amount ELSE 0 END) as ad_spend,
  SUM(CASE WHEN category = 'LOYERS' THEN amount ELSE 0 END) as rent,
  SUM(CASE WHEN category = 'LOGICIELS' THEN amount ELSE 0 END) as computer_software,
  SUM(CASE WHEN category = 'TELEPHONIE' THEN amount ELSE 0 END) as internet_telephone,
  SUM(CASE WHEN category = 'ABONNEMENTS' THEN amount ELSE 0 END) as subscriptions,
  SUM(CASE WHEN category = 'RETRAIT BANCOMAT' THEN amount ELSE 0 END) as bank_finance_charges,
  SUM(CASE WHEN category = 'SALAIRES' THEN amount ELSE 0 END) as salaries,
  SUM(CASE WHEN category = 'SALAIRES COACH' THEN amount ELSE 0 END) as salaries_coach,
  SUM(CASE WHEN category = 'ALIMENTAIRE' THEN amount ELSE 0 END) as food_expenses,
  SUM(CASE WHEN category = 'REMBOURSEMENT PRÊT' THEN amount ELSE 0 END) as credit_repayment,
  SUM(amount) as total_expenses
FROM public.accounting_transactions
WHERE transaction_type = 'expense'
GROUP BY year, month, month_name
ON CONFLICT (year, month)
DO UPDATE SET
  ad_spend = EXCLUDED.ad_spend,
  rent = EXCLUDED.rent,
  computer_software = EXCLUDED.computer_software,
  internet_telephone = EXCLUDED.internet_telephone,
  subscriptions = EXCLUDED.subscriptions,
  bank_finance_charges = EXCLUDED.bank_finance_charges,
  salaries = EXCLUDED.salaries,
  salaries_coach = EXCLUDED.salaries_coach,
  food_expenses = EXCLUDED.food_expenses,
  credit_repayment = EXCLUDED.credit_repayment,
  total_expenses = EXCLUDED.total_expenses;

-- 5) Recompute profit
UPDATE public.monthly_kpis
SET profit = COALESCE(total_revenue, 0) - COALESCE(total_expenses, 0);