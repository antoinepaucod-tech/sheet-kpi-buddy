-- Function to sync instructor costs from course_kpis to accounting_transactions
CREATE OR REPLACE FUNCTION public.sync_course_kpis_to_accounting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_names text[] := ARRAY['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                               'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  instructor_name text;
  total_expenses numeric;
  existing_transaction_id uuid;
BEGIN
  -- Handle DELETE: remove instructor's transaction if they have no more courses
  IF TG_OP = 'DELETE' THEN
    IF OLD.instructor IS NOT NULL THEN
      -- Check if instructor has any other courses in this month
      SELECT COUNT(*) INTO total_expenses
      FROM course_kpis
      WHERE instructor = OLD.instructor
        AND year = OLD.year
        AND month = OLD.month
        AND id != OLD.id;
      
      -- If no more courses, delete the transaction
      IF total_expenses = 0 THEN
        DELETE FROM accounting_transactions
        WHERE year = OLD.year
          AND month = OLD.month
          AND category = 'SALAIRES COACH'
          AND client_name = OLD.instructor
          AND notes = 'Synchronisé depuis KPI Cours';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT/UPDATE: update instructor's total for the month
  IF NEW.instructor IS NOT NULL THEN
    -- Calculate total expenses for this instructor in this month
    SELECT COALESCE(SUM(monthly_expenses), 0)
    INTO total_expenses
    FROM course_kpis
    WHERE instructor = NEW.instructor
      AND year = NEW.year
      AND month = NEW.month;

    -- Check if transaction already exists
    SELECT id INTO existing_transaction_id
    FROM accounting_transactions
    WHERE year = NEW.year
      AND month = NEW.month
      AND category = 'SALAIRES COACH'
      AND client_name = NEW.instructor
      AND notes = 'Synchronisé depuis KPI Cours'
    LIMIT 1;

    IF existing_transaction_id IS NOT NULL THEN
      -- Update existing transaction
      UPDATE accounting_transactions
      SET amount = total_expenses,
          amount_received = total_expenses,
          transaction_date = make_date(NEW.year, NEW.month, 1)
      WHERE id = existing_transaction_id;
    ELSE
      -- Create new transaction only if total_expenses > 0
      IF total_expenses > 0 THEN
        INSERT INTO accounting_transactions (
          transaction_type,
          category,
          client_name,
          service_description,
          amount,
          amount_received,
          transaction_date,
          year,
          month,
          month_name,
          is_validated,
          is_auto_generated,
          notes
        ) VALUES (
          'expense',
          'SALAIRES COACH',
          NEW.instructor,
          'cours collectif',
          total_expenses,
          total_expenses,
          make_date(NEW.year, NEW.month, 1),
          NEW.year,
          NEW.month,
          month_names[NEW.month],
          true,
          true,
          'Synchronisé depuis KPI Cours'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for sync on INSERT/UPDATE/DELETE
DROP TRIGGER IF EXISTS sync_course_kpis_to_accounting_trigger ON public.course_kpis;
CREATE TRIGGER sync_course_kpis_to_accounting_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.course_kpis
FOR EACH ROW
EXECUTE FUNCTION public.sync_course_kpis_to_accounting();

-- Initial sync: delete old auto-generated coach salary entries and recreate them
DELETE FROM accounting_transactions
WHERE category = 'SALAIRES COACH'
  AND notes = 'Synchronisé depuis KPI Cours';

-- Recreate all current coach salary entries
INSERT INTO accounting_transactions (
  transaction_type,
  category,
  client_name,
  service_description,
  amount,
  amount_received,
  transaction_date,
  year,
  month,
  month_name,
  is_validated,
  is_auto_generated,
  notes
)
SELECT 
  'expense',
  'SALAIRES COACH',
  instructor,
  'cours collectif',
  SUM(monthly_expenses),
  SUM(monthly_expenses),
  make_date(year, month, 1),
  year,
  month,
  month_name,
  true,
  true,
  'Synchronisé depuis KPI Cours'
FROM course_kpis
WHERE instructor IS NOT NULL
GROUP BY instructor, year, month, month_name
HAVING SUM(monthly_expenses) > 0;