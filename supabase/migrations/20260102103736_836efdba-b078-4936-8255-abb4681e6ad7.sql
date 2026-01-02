-- Drop ALL triggers that depend on calculate_course_kpis
DROP TRIGGER IF EXISTS course_kpis_trigger ON public.course_kpis;
DROP TRIGGER IF EXISTS calculate_course_kpis_before_write ON public.course_kpis;
DROP TRIGGER IF EXISTS calculate_course_kpis_trigger ON public.course_kpis;

-- Drop the function with CASCADE to remove all dependencies
DROP FUNCTION IF EXISTS public.calculate_course_kpis() CASCADE;

-- Recreate the function
CREATE OR REPLACE FUNCTION public.calculate_course_kpis()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total_attendance INTEGER;
  weeks_with_classes INTEGER;
  instructor_rate NUMERIC;
  total_expenses NUMERIC := 0;
  week_instructor TEXT;
  week_attendance INTEGER;
BEGIN
  -- Calculate total attendance
  total_attendance := COALESCE(NEW.week1_attendance, 0) + 
                      COALESCE(NEW.week2_attendance, 0) + 
                      COALESCE(NEW.week3_attendance, 0) + 
                      COALESCE(NEW.week4_attendance, 0) + 
                      COALESCE(NEW.week5_attendance, 0);
  
  -- Count weeks that had classes
  weeks_with_classes := 0;
  IF COALESCE(NEW.week1_attendance, 0) > 0 THEN weeks_with_classes := weeks_with_classes + 1; END IF;
  IF COALESCE(NEW.week2_attendance, 0) > 0 THEN weeks_with_classes := weeks_with_classes + 1; END IF;
  IF COALESCE(NEW.week3_attendance, 0) > 0 THEN weeks_with_classes := weeks_with_classes + 1; END IF;
  IF COALESCE(NEW.week4_attendance, 0) > 0 THEN weeks_with_classes := weeks_with_classes + 1; END IF;
  IF COALESCE(NEW.week5_attendance, 0) > 0 THEN weeks_with_classes := weeks_with_classes + 1; END IF;
  
  -- Calculate attendance rate
  IF weeks_with_classes > 0 AND COALESCE(NEW.max_capacity, 0) > 0 THEN
    NEW.attendance_rate := (total_attendance::NUMERIC / (weeks_with_classes * NEW.max_capacity)) * 100;
  ELSE
    NEW.attendance_rate := 0;
  END IF;
  
  -- Week 1
  week_instructor := COALESCE(NEW.week1_instructor, NEW.instructor);
  week_attendance := COALESCE(NEW.week1_attendance, 0);
  IF week_instructor IS NOT NULL AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE name = week_instructor LIMIT 1;
    IF instructor_rate IS NOT NULL THEN total_expenses := total_expenses + instructor_rate; END IF;
  END IF;
  
  -- Week 2
  week_instructor := COALESCE(NEW.week2_instructor, NEW.instructor);
  week_attendance := COALESCE(NEW.week2_attendance, 0);
  IF week_instructor IS NOT NULL AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE name = week_instructor LIMIT 1;
    IF instructor_rate IS NOT NULL THEN total_expenses := total_expenses + instructor_rate; END IF;
  END IF;
  
  -- Week 3
  week_instructor := COALESCE(NEW.week3_instructor, NEW.instructor);
  week_attendance := COALESCE(NEW.week3_attendance, 0);
  IF week_instructor IS NOT NULL AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE name = week_instructor LIMIT 1;
    IF instructor_rate IS NOT NULL THEN total_expenses := total_expenses + instructor_rate; END IF;
  END IF;
  
  -- Week 4
  week_instructor := COALESCE(NEW.week4_instructor, NEW.instructor);
  week_attendance := COALESCE(NEW.week4_attendance, 0);
  IF week_instructor IS NOT NULL AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE name = week_instructor LIMIT 1;
    IF instructor_rate IS NOT NULL THEN total_expenses := total_expenses + instructor_rate; END IF;
  END IF;
  
  -- Week 5
  week_instructor := COALESCE(NEW.week5_instructor, NEW.instructor);
  week_attendance := COALESCE(NEW.week5_attendance, 0);
  IF week_instructor IS NOT NULL AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE name = week_instructor LIMIT 1;
    IF instructor_rate IS NOT NULL THEN total_expenses := total_expenses + instructor_rate; END IF;
  END IF;
  
  NEW.monthly_expenses := total_expenses;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER calculate_course_kpis_before_write
  BEFORE INSERT OR UPDATE ON public.course_kpis
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_course_kpis();

-- Also fix the sync_course_kpis_to_accounting function that uses unnest incorrectly
CREATE OR REPLACE FUNCTION public.sync_course_kpis_to_accounting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  month_names text[] := ARRAY['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                               'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  total_expenses numeric;
  existing_transaction_id uuid;
  instr text;
  instr_list text[];
BEGIN
  -- Handle DELETE: recalculate for all instructors in this month
  IF TG_OP = 'DELETE' THEN
    -- Build list of instructors from this course
    instr_list := ARRAY[]::text[];
    IF OLD.instructor IS NOT NULL THEN instr_list := array_append(instr_list, OLD.instructor); END IF;
    IF OLD.week1_instructor IS NOT NULL THEN instr_list := array_append(instr_list, OLD.week1_instructor); END IF;
    IF OLD.week2_instructor IS NOT NULL THEN instr_list := array_append(instr_list, OLD.week2_instructor); END IF;
    IF OLD.week3_instructor IS NOT NULL THEN instr_list := array_append(instr_list, OLD.week3_instructor); END IF;
    IF OLD.week4_instructor IS NOT NULL THEN instr_list := array_append(instr_list, OLD.week4_instructor); END IF;
    IF OLD.week5_instructor IS NOT NULL THEN instr_list := array_append(instr_list, OLD.week5_instructor); END IF;
    
    -- Remove duplicates
    SELECT array_agg(DISTINCT x) INTO instr_list FROM unnest(instr_list) AS x WHERE x IS NOT NULL;
    
    IF instr_list IS NOT NULL THEN
      FOREACH instr IN ARRAY instr_list LOOP
        -- Recalculate total for this instructor
        SELECT COALESCE(SUM(
          CASE WHEN COALESCE(week1_instructor, instructor) = instr AND COALESCE(week1_attendance, 0) > 0 
               THEN (SELECT hourly_rate FROM instructors WHERE name = instr LIMIT 1) ELSE 0 END +
          CASE WHEN COALESCE(week2_instructor, instructor) = instr AND COALESCE(week2_attendance, 0) > 0 
               THEN (SELECT hourly_rate FROM instructors WHERE name = instr LIMIT 1) ELSE 0 END +
          CASE WHEN COALESCE(week3_instructor, instructor) = instr AND COALESCE(week3_attendance, 0) > 0 
               THEN (SELECT hourly_rate FROM instructors WHERE name = instr LIMIT 1) ELSE 0 END +
          CASE WHEN COALESCE(week4_instructor, instructor) = instr AND COALESCE(week4_attendance, 0) > 0 
               THEN (SELECT hourly_rate FROM instructors WHERE name = instr LIMIT 1) ELSE 0 END +
          CASE WHEN COALESCE(week5_instructor, instructor) = instr AND COALESCE(week5_attendance, 0) > 0 
               THEN (SELECT hourly_rate FROM instructors WHERE name = instr LIMIT 1) ELSE 0 END
        ), 0)
        INTO total_expenses
        FROM course_kpis
        WHERE year = OLD.year AND month = OLD.month AND id != OLD.id;
        
        IF total_expenses = 0 THEN
          DELETE FROM accounting_transactions
          WHERE year = OLD.year
            AND month = OLD.month
            AND category = 'SALAIRES COACH'
            AND client_name = instr
            AND notes = 'Synchronisé depuis KPI Cours';
        ELSE
          UPDATE accounting_transactions
          SET amount = total_expenses,
              amount_received = total_expenses
          WHERE year = OLD.year
            AND month = OLD.month
            AND category = 'SALAIRES COACH'
            AND client_name = instr
            AND notes = 'Synchronisé depuis KPI Cours';
        END IF;
      END LOOP;
    END IF;
    
    RETURN OLD;
  END IF;

  -- Handle INSERT/UPDATE: Build list of instructors
  instr_list := ARRAY[]::text[];
  IF NEW.instructor IS NOT NULL AND NEW.instructor <> '' THEN instr_list := array_append(instr_list, NEW.instructor); END IF;
  IF NEW.week1_instructor IS NOT NULL AND NEW.week1_instructor <> '' THEN instr_list := array_append(instr_list, NEW.week1_instructor); END IF;
  IF NEW.week2_instructor IS NOT NULL AND NEW.week2_instructor <> '' THEN instr_list := array_append(instr_list, NEW.week2_instructor); END IF;
  IF NEW.week3_instructor IS NOT NULL AND NEW.week3_instructor <> '' THEN instr_list := array_append(instr_list, NEW.week3_instructor); END IF;
  IF NEW.week4_instructor IS NOT NULL AND NEW.week4_instructor <> '' THEN instr_list := array_append(instr_list, NEW.week4_instructor); END IF;
  IF NEW.week5_instructor IS NOT NULL AND NEW.week5_instructor <> '' THEN instr_list := array_append(instr_list, NEW.week5_instructor); END IF;
  
  -- Remove duplicates
  SELECT array_agg(DISTINCT x) INTO instr_list FROM unnest(instr_list) AS x WHERE x IS NOT NULL AND x <> '';
  
  IF instr_list IS NOT NULL THEN
    FOREACH instr IN ARRAY instr_list LOOP
      -- Calculate total expenses for this instructor in this month
      SELECT COALESCE(SUM(
        CASE WHEN COALESCE(week1_instructor, instructor) = instr AND COALESCE(week1_attendance, 0) > 0 
             THEN (SELECT COALESCE(hourly_rate, 0) FROM instructors WHERE name = instr LIMIT 1) ELSE 0 END +
        CASE WHEN COALESCE(week2_instructor, instructor) = instr AND COALESCE(week2_attendance, 0) > 0 
             THEN (SELECT COALESCE(hourly_rate, 0) FROM instructors WHERE name = instr LIMIT 1) ELSE 0 END +
        CASE WHEN COALESCE(week3_instructor, instructor) = instr AND COALESCE(week3_attendance, 0) > 0 
             THEN (SELECT COALESCE(hourly_rate, 0) FROM instructors WHERE name = instr LIMIT 1) ELSE 0 END +
        CASE WHEN COALESCE(week4_instructor, instructor) = instr AND COALESCE(week4_attendance, 0) > 0 
             THEN (SELECT COALESCE(hourly_rate, 0) FROM instructors WHERE name = instr LIMIT 1) ELSE 0 END +
        CASE WHEN COALESCE(week5_instructor, instructor) = instr AND COALESCE(week5_attendance, 0) > 0 
             THEN (SELECT COALESCE(hourly_rate, 0) FROM instructors WHERE name = instr LIMIT 1) ELSE 0 END
      ), 0)
      INTO total_expenses
      FROM course_kpis
      WHERE year = NEW.year AND month = NEW.month;

      -- Check if transaction already exists
      SELECT id INTO existing_transaction_id
      FROM accounting_transactions
      WHERE year = NEW.year
        AND month = NEW.month
        AND category = 'SALAIRES COACH'
        AND client_name = instr
        AND notes = 'Synchronisé depuis KPI Cours'
      LIMIT 1;

      IF existing_transaction_id IS NOT NULL THEN
        IF total_expenses > 0 THEN
          UPDATE accounting_transactions
          SET amount = total_expenses,
              amount_received = total_expenses,
              transaction_date = make_date(NEW.year, NEW.month, 1)
          WHERE id = existing_transaction_id;
        ELSE
          DELETE FROM accounting_transactions WHERE id = existing_transaction_id;
        END IF;
      ELSE
        IF total_expenses > 0 THEN
          INSERT INTO accounting_transactions (
            transaction_type, category, client_name, service_description,
            amount, amount_received, transaction_date, year, month, month_name,
            is_validated, is_auto_generated, notes
          ) VALUES (
            'expense', 'SALAIRES COACH', instr, 'cours collectif',
            total_expenses, total_expenses, make_date(NEW.year, NEW.month, 1),
            NEW.year, NEW.month, month_names[NEW.month],
            true, true, 'Synchronisé depuis KPI Cours'
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the sync trigger
DROP TRIGGER IF EXISTS sync_course_kpis_to_accounting_trigger ON public.course_kpis;
CREATE TRIGGER sync_course_kpis_to_accounting_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.course_kpis
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_course_kpis_to_accounting();