-- Function to automatically calculate profit whenever revenue or expenses change
CREATE OR REPLACE FUNCTION calculate_profit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calculate profit as total_revenue - total_expenses
  NEW.profit := COALESCE(NEW.total_revenue, 0) - COALESCE(NEW.total_expenses, 0);
  RETURN NEW;
END;
$$;

-- Create trigger to calculate profit before insert or update
DROP TRIGGER IF EXISTS calculate_profit_trigger ON monthly_kpis;
CREATE TRIGGER calculate_profit_trigger
  BEFORE INSERT OR UPDATE OF total_revenue, total_expenses ON monthly_kpis
  FOR EACH ROW
  EXECUTE FUNCTION calculate_profit();

-- Update existing records to calculate profit
UPDATE monthly_kpis
SET profit = COALESCE(total_revenue, 0) - COALESCE(total_expenses, 0)
WHERE profit != (COALESCE(total_revenue, 0) - COALESCE(total_expenses, 0)) OR profit IS NULL;