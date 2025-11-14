-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sync_course_kpis_to_accounting_trigger ON course_kpis;
DROP TRIGGER IF EXISTS calculate_course_kpis_trigger ON course_kpis;
DROP TRIGGER IF EXISTS sync_members_to_monthly_kpis_trigger ON customer_members;
DROP TRIGGER IF EXISTS sync_revenue_to_monthly_kpis_trigger ON accounting_transactions;
DROP TRIGGER IF EXISTS sync_expenses_to_monthly_kpis_trigger ON accounting_transactions;
DROP TRIGGER IF EXISTS sync_cash_collected_to_monthly_kpis_trigger ON accounting_transactions;
DROP TRIGGER IF EXISTS calculate_profit_trigger ON monthly_kpis;
DROP TRIGGER IF EXISTS update_accounting_transactions_updated_at ON accounting_transactions;

-- Recreate all triggers
CREATE TRIGGER calculate_course_kpis_trigger
BEFORE INSERT OR UPDATE ON course_kpis
FOR EACH ROW
EXECUTE FUNCTION calculate_course_kpis();

CREATE TRIGGER sync_course_kpis_to_accounting_trigger
AFTER INSERT OR UPDATE OR DELETE ON course_kpis
FOR EACH ROW
EXECUTE FUNCTION sync_course_kpis_to_accounting();

CREATE TRIGGER sync_members_to_monthly_kpis_trigger
AFTER INSERT OR UPDATE OR DELETE ON customer_members
FOR EACH ROW
EXECUTE FUNCTION sync_members_to_monthly_kpis();

CREATE TRIGGER sync_revenue_to_monthly_kpis_trigger
AFTER INSERT OR UPDATE OR DELETE ON accounting_transactions
FOR EACH ROW
EXECUTE FUNCTION sync_revenue_to_monthly_kpis();

CREATE TRIGGER sync_expenses_to_monthly_kpis_trigger
AFTER INSERT OR UPDATE OR DELETE ON accounting_transactions
FOR EACH ROW
EXECUTE FUNCTION sync_expenses_to_monthly_kpis();

CREATE TRIGGER sync_cash_collected_to_monthly_kpis_trigger
AFTER INSERT OR UPDATE OR DELETE ON accounting_transactions
FOR EACH ROW
EXECUTE FUNCTION sync_cash_collected_to_monthly_kpis();

CREATE TRIGGER calculate_profit_trigger
BEFORE INSERT OR UPDATE ON monthly_kpis
FOR EACH ROW
EXECUTE FUNCTION calculate_profit();

CREATE TRIGGER update_accounting_transactions_updated_at
BEFORE UPDATE ON accounting_transactions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();