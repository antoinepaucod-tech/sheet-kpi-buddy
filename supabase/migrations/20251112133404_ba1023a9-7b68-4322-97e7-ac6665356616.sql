-- Function to sync expenses from accounting_transactions to monthly_kpis
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
  expense_repairs NUMERIC;
  expense_software NUMERIC;
  expense_internet NUMERIC;
  expense_stationary NUMERIC;
  expense_utilities NUMERIC;
  expense_advertising NUMERIC;
  expense_legal NUMERIC;
  expense_donations NUMERIC;
  expense_subscriptions NUMERIC;
  expense_bank NUMERIC;
  expense_insurance NUMERIC;
  expense_salaries NUMERIC;
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

  -- Calculate expenses by category
  SELECT 
    COALESCE(SUM(CASE WHEN category = 'Publicité' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Loyer' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Réparations et Entretien' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Informatique et Logiciels' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Internet et Téléphone' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Papeterie' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Services Publics' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Marketing et Promotion' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Juridique et Professionnel' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Dons de Bienfaisance' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Abonnements' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Frais Bancaires et Financiers' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Assurance' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Salaires' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Alimentation' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Remboursement de Crédit' THEN amount ELSE 0 END), 0)
  INTO 
    expense_ad_spend,
    expense_rent,
    expense_repairs,
    expense_software,
    expense_internet,
    expense_stationary,
    expense_utilities,
    expense_advertising,
    expense_legal,
    expense_donations,
    expense_subscriptions,
    expense_bank,
    expense_insurance,
    expense_salaries,
    expense_food,
    expense_credit
  FROM accounting_transactions
  WHERE transaction_type = 'expense'
    AND year = affected_year
    AND month = affected_month;

  -- Calculate total expenses
  total_exp := expense_ad_spend + expense_rent + expense_repairs + expense_software + 
               expense_internet + expense_stationary + expense_utilities + expense_advertising +
               expense_legal + expense_donations + expense_subscriptions + expense_bank +
               expense_insurance + expense_salaries + expense_food + expense_credit;

  -- Upsert into monthly_kpis
  INSERT INTO monthly_kpis (
    year, month, month_name, 
    ad_spend, rent, repairs_maintenance, computer_software, internet_telephone,
    stationary, utilities, advertising_promotion, legal_professional, charitable_donations,
    subscriptions, bank_finance_charges, insurance, salaries, food_expenses, credit_repayment,
    total_expenses
  )
  VALUES (
    affected_year,
    affected_month,
    affected_month_name,
    expense_ad_spend,
    expense_rent,
    expense_repairs,
    expense_software,
    expense_internet,
    expense_stationary,
    expense_utilities,
    expense_advertising,
    expense_legal,
    expense_donations,
    expense_subscriptions,
    expense_bank,
    expense_insurance,
    expense_salaries,
    expense_food,
    expense_credit,
    total_exp
  )
  ON CONFLICT (year, month)
  DO UPDATE SET 
    ad_spend = EXCLUDED.ad_spend,
    rent = EXCLUDED.rent,
    repairs_maintenance = EXCLUDED.repairs_maintenance,
    computer_software = EXCLUDED.computer_software,
    internet_telephone = EXCLUDED.internet_telephone,
    stationary = EXCLUDED.stationary,
    utilities = EXCLUDED.utilities,
    advertising_promotion = EXCLUDED.advertising_promotion,
    legal_professional = EXCLUDED.legal_professional,
    charitable_donations = EXCLUDED.charitable_donations,
    subscriptions = EXCLUDED.subscriptions,
    bank_finance_charges = EXCLUDED.bank_finance_charges,
    insurance = EXCLUDED.insurance,
    salaries = EXCLUDED.salaries,
    food_expenses = EXCLUDED.food_expenses,
    credit_repayment = EXCLUDED.credit_repayment,
    total_expenses = EXCLUDED.total_expenses;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for expenses sync
DROP TRIGGER IF EXISTS sync_expenses_trigger ON accounting_transactions;
CREATE TRIGGER sync_expenses_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_transactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_expenses_to_monthly_kpis();

-- Initial sync for existing expense data
INSERT INTO monthly_kpis (
  year, month, month_name,
  ad_spend, rent, repairs_maintenance, computer_software, internet_telephone,
  stationary, utilities, advertising_promotion, legal_professional, charitable_donations,
  subscriptions, bank_finance_charges, insurance, salaries, food_expenses, credit_repayment,
  total_expenses
)
SELECT 
  year,
  month,
  month_name,
  SUM(CASE WHEN category = 'Publicité' THEN amount ELSE 0 END) as ad_spend,
  SUM(CASE WHEN category = 'Loyer' THEN amount ELSE 0 END) as rent,
  SUM(CASE WHEN category = 'Réparations et Entretien' THEN amount ELSE 0 END) as repairs,
  SUM(CASE WHEN category = 'Informatique et Logiciels' THEN amount ELSE 0 END) as software,
  SUM(CASE WHEN category = 'Internet et Téléphone' THEN amount ELSE 0 END) as internet,
  SUM(CASE WHEN category = 'Papeterie' THEN amount ELSE 0 END) as stationary,
  SUM(CASE WHEN category = 'Services Publics' THEN amount ELSE 0 END) as utilities,
  SUM(CASE WHEN category = 'Marketing et Promotion' THEN amount ELSE 0 END) as advertising,
  SUM(CASE WHEN category = 'Juridique et Professionnel' THEN amount ELSE 0 END) as legal,
  SUM(CASE WHEN category = 'Dons de Bienfaisance' THEN amount ELSE 0 END) as donations,
  SUM(CASE WHEN category = 'Abonnements' THEN amount ELSE 0 END) as subscriptions,
  SUM(CASE WHEN category = 'Frais Bancaires et Financiers' THEN amount ELSE 0 END) as bank,
  SUM(CASE WHEN category = 'Assurance' THEN amount ELSE 0 END) as insurance,
  SUM(CASE WHEN category = 'Salaires' THEN amount ELSE 0 END) as salaries,
  SUM(CASE WHEN category = 'Alimentation' THEN amount ELSE 0 END) as food,
  SUM(CASE WHEN category = 'Remboursement de Crédit' THEN amount ELSE 0 END) as credit,
  SUM(amount) as total_exp
FROM accounting_transactions
WHERE transaction_type = 'expense'
GROUP BY year, month, month_name
ON CONFLICT (year, month)
DO UPDATE SET 
  ad_spend = EXCLUDED.ad_spend,
  rent = EXCLUDED.rent,
  repairs_maintenance = EXCLUDED.repairs_maintenance,
  computer_software = EXCLUDED.computer_software,
  internet_telephone = EXCLUDED.internet_telephone,
  stationary = EXCLUDED.stationary,
  utilities = EXCLUDED.utilities,
  advertising_promotion = EXCLUDED.advertising_promotion,
  legal_professional = EXCLUDED.legal_professional,
  charitable_donations = EXCLUDED.charitable_donations,
  subscriptions = EXCLUDED.subscriptions,
  bank_finance_charges = EXCLUDED.bank_finance_charges,
  insurance = EXCLUDED.insurance,
  salaries = EXCLUDED.salaries,
  food_expenses = EXCLUDED.food_expenses,
  credit_repayment = EXCLUDED.credit_repayment,
  total_expenses = EXCLUDED.total_expenses;