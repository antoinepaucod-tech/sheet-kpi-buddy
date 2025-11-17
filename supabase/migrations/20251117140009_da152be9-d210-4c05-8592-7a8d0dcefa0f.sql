-- Modifier le trigger pour utiliser amount_received pour les dépenses
DROP TRIGGER IF EXISTS sync_expenses_trigger ON public.accounting_transactions;
DROP FUNCTION IF EXISTS public.sync_expenses_to_monthly_kpis() CASCADE;

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

  -- Calculate expenses per category using amount_received (cash paid)
  SELECT 
    COALESCE(SUM(CASE WHEN category = 'PUBLICITÉ' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'LOYERS' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'LOGICIELS' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'TELEPHONIE' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'ABONNEMENTS' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'RETRAIT BANCOMAT' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'SALAIRES' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'SALAIRES COACH' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'ALIMENTAIRE' THEN amount_received ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'REMBOURSEMENT PRÊT' THEN amount_received ELSE 0 END), 0)
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

CREATE TRIGGER sync_expenses_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.accounting_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_expenses_to_monthly_kpis();

-- Resynchroniser les dépenses existantes
UPDATE monthly_kpis SET updated_at = now() WHERE year >= 2025;