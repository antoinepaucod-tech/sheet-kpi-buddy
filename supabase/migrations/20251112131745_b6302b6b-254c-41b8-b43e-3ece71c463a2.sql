-- Function to synchronize cash collected from accounting_transactions to monthly_kpis
CREATE OR REPLACE FUNCTION sync_cash_collected_to_monthly_kpis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_cash NUMERIC;
  affected_year INTEGER;
  affected_month INTEGER;
  affected_month_name TEXT;
BEGIN
  -- Determine affected year/month
  IF TG_OP = 'DELETE' THEN
    -- Only sync if deleted transaction was revenue
    IF OLD.transaction_type != 'revenue' THEN
      RETURN OLD;
    END IF;
    affected_year := OLD.year;
    affected_month := OLD.month;
    affected_month_name := OLD.month_name;
  ELSE
    -- Only sync if new/updated transaction is revenue
    IF NEW.transaction_type != 'revenue' THEN
      RETURN NEW;
    END IF;
    affected_year := NEW.year;
    affected_month := NEW.month;
    affected_month_name := NEW.month_name;
  END IF;

  -- Calculate total amount_received for the month/year
  SELECT COALESCE(SUM(amount_received), 0)
  INTO total_cash
  FROM accounting_transactions
  WHERE transaction_type = 'revenue'
    AND year = affected_year
    AND month = affected_month;

  -- Upsert into monthly_kpis
  INSERT INTO monthly_kpis (year, month, month_name, cash_collected)
  VALUES (
    affected_year,
    affected_month,
    affected_month_name,
    total_cash
  )
  ON CONFLICT (year, month)
  DO UPDATE SET cash_collected = total_cash;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on accounting_transactions
DROP TRIGGER IF EXISTS sync_cash_collected_trigger ON accounting_transactions;
CREATE TRIGGER sync_cash_collected_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_transactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_cash_collected_to_monthly_kpis();

-- Initial sync for existing data
INSERT INTO monthly_kpis (year, month, month_name, cash_collected)
SELECT 
  year,
  month,
  month_name,
  SUM(amount_received) as cash_collected
FROM accounting_transactions
WHERE transaction_type = 'revenue'
GROUP BY year, month, month_name
ON CONFLICT (year, month)
DO UPDATE SET cash_collected = EXCLUDED.cash_collected;