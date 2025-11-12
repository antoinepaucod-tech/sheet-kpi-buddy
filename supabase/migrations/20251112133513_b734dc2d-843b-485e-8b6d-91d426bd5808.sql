-- Update function to sync expenses with correct category names
CREATE OR REPLACE FUNCTION sync_expenses_to_monthly_kpis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Calculate expenses by actual category names in DB
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
  FROM accounting_transactions
  WHERE transaction_type = 'expense'
    AND year = affected_year
    AND month = affected_month;

  -- Calculate total expenses (include coach salaries in total)
  total_exp := expense_ad_spend + expense_rent + expense_software + expense_internet + 
               expense_subscriptions + expense_bank + expense_salaries + expense_salaries_coach +
               expense_food + expense_credit;

  -- Upsert into monthly_kpis
  INSERT INTO monthly_kpis (
    year, month, month_name, 
    ad_spend, rent, computer_software, internet_telephone,
    subscriptions, bank_finance_charges, salaries, food_expenses, credit_repayment,
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
    expense_salaries + expense_salaries_coach,  -- Combine both salary types
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
    food_expenses = EXCLUDED.food_expenses,
    credit_repayment = EXCLUDED.credit_repayment,
    total_expenses = EXCLUDED.total_expenses;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Re-sync existing expense data with correct category names
INSERT INTO monthly_kpis (
  year, month, month_name,
  ad_spend, rent, computer_software, internet_telephone,
  subscriptions, bank_finance_charges, salaries, food_expenses, credit_repayment,
  total_expenses
)
SELECT 
  year,
  month,
  month_name,
  SUM(CASE WHEN category = 'PUBLICITÉ' THEN amount ELSE 0 END) as ad_spend,
  SUM(CASE WHEN category = 'LOYERS' THEN amount ELSE 0 END) as rent,
  SUM(CASE WHEN category = 'LOGICIELS' THEN amount ELSE 0 END) as software,
  SUM(CASE WHEN category = 'TELEPHONIE' THEN amount ELSE 0 END) as internet,
  SUM(CASE WHEN category = 'ABONNEMENTS' THEN amount ELSE 0 END) as subscriptions,
  SUM(CASE WHEN category = 'RETRAIT BANCOMAT' THEN amount ELSE 0 END) as bank,
  SUM(CASE WHEN category = 'SALAIRES' THEN amount ELSE 0 END) + SUM(CASE WHEN category = 'SALAIRES COACH' THEN amount ELSE 0 END) as salaries,
  SUM(CASE WHEN category = 'ALIMENTAIRE' THEN amount ELSE 0 END) as food,
  SUM(CASE WHEN category = 'REMBOURSEMENT PRÊT' THEN amount ELSE 0 END) as credit,
  SUM(amount) as total_exp
FROM accounting_transactions
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
  food_expenses = EXCLUDED.food_expenses,
  credit_repayment = EXCLUDED.credit_repayment,
  total_expenses = EXCLUDED.total_expenses;