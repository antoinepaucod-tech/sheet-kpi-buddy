-- Drop existing trigger and function
DROP TRIGGER IF EXISTS sync_cash_collected_trigger ON accounting_transactions;
DROP FUNCTION IF EXISTS sync_cash_collected_to_monthly_kpis();

-- Create updated function that uses amount_received instead of amount
CREATE OR REPLACE FUNCTION sync_cash_collected_to_monthly_kpis()
RETURNS TRIGGER AS $$
BEGIN
  -- For INSERT and UPDATE operations
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Only process revenue transactions
    IF NEW.transaction_type = 'revenue' THEN
      -- Update or insert the monthly_kpis record
      INSERT INTO monthly_kpis (year, month, month_name, cash_collected)
      VALUES (
        NEW.year,
        NEW.month,
        NEW.month_name,
        COALESCE((
          SELECT SUM(amount_received)
          FROM accounting_transactions
          WHERE year = NEW.year
            AND month = NEW.month
            AND transaction_type = 'revenue'
        ), 0)
      )
      ON CONFLICT (year, month)
      DO UPDATE SET
        cash_collected = COALESCE((
          SELECT SUM(amount_received)
          FROM accounting_transactions
          WHERE year = NEW.year
            AND month = NEW.month
            AND transaction_type = 'revenue'
        ), 0);
    END IF;
    RETURN NEW;
  END IF;

  -- For DELETE operations
  IF (TG_OP = 'DELETE') THEN
    IF OLD.transaction_type = 'revenue' THEN
      UPDATE monthly_kpis
      SET cash_collected = COALESCE((
        SELECT SUM(amount_received)
        FROM accounting_transactions
        WHERE year = OLD.year
          AND month = OLD.month
          AND transaction_type = 'revenue'
      ), 0)
      WHERE year = OLD.year AND month = OLD.month;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER sync_cash_collected_trigger
AFTER INSERT OR UPDATE OR DELETE ON accounting_transactions
FOR EACH ROW
EXECUTE FUNCTION sync_cash_collected_to_monthly_kpis();

-- Initial sync: Update all existing monthly_kpis with correct cash_collected from amount_received
INSERT INTO monthly_kpis (year, month, month_name, cash_collected)
SELECT 
  year,
  month,
  month_name,
  COALESCE(SUM(amount_received), 0) as cash_collected
FROM accounting_transactions
WHERE transaction_type = 'revenue'
GROUP BY year, month, month_name
ON CONFLICT (year, month)
DO UPDATE SET
  cash_collected = EXCLUDED.cash_collected;