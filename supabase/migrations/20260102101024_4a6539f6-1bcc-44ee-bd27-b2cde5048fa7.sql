-- Add per-week instructor columns to course_kpis
ALTER TABLE public.course_kpis 
ADD COLUMN week1_instructor text DEFAULT NULL,
ADD COLUMN week2_instructor text DEFAULT NULL,
ADD COLUMN week3_instructor text DEFAULT NULL,
ADD COLUMN week4_instructor text DEFAULT NULL,
ADD COLUMN week5_instructor text DEFAULT NULL;

-- Update the calculate_course_kpis function to handle per-week instructors
CREATE OR REPLACE FUNCTION public.calculate_course_kpis()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  weeks integer[];
  week_instructors text[];
  non_zero_weeks integer;
  total_attendance integer;
  max_capacity_val integer;
  total_expenses numeric := 0;
  i integer;
  instructor_name text;
  hourly_rate_val numeric;
BEGIN
  -- Build weeks array handling nulls as zeros
  weeks := ARRAY[
    COALESCE(NEW.week1_attendance, 0),
    COALESCE(NEW.week2_attendance, 0),
    COALESCE(NEW.week3_attendance, 0),
    COALESCE(NEW.week4_attendance, 0),
    COALESCE(NEW.week5_attendance, 0)
  ];

  -- Build week instructors array - use per-week instructor if set, otherwise fall back to main instructor
  week_instructors := ARRAY[
    COALESCE(NEW.week1_instructor, NEW.instructor),
    COALESCE(NEW.week2_instructor, NEW.instructor),
    COALESCE(NEW.week3_instructor, NEW.instructor),
    COALESCE(NEW.week4_instructor, NEW.instructor),
    COALESCE(NEW.week5_instructor, NEW.instructor)
  ];

  -- Count weeks with attendance > 0 and sum attendance
  SELECT COUNT(*) FILTER (WHERE w > 0), COALESCE(SUM(w), 0)
  INTO non_zero_weeks, total_attendance
  FROM unnest(weeks) AS w;

  max_capacity_val := COALESCE(NEW.max_capacity, 10);

  -- Compute attendance rate
  IF non_zero_weeks > 0 AND max_capacity_val > 0 THEN
    NEW.attendance_rate := (total_attendance::numeric / (non_zero_weeks * max_capacity_val)) * 100;
  ELSE
    NEW.attendance_rate := 0;
  END IF;

  -- Compute monthly expenses based on per-week instructors
  -- Only count weeks where there was attendance (attendance > 0)
  FOR i IN 1..5 LOOP
    IF weeks[i] > 0 THEN
      instructor_name := week_instructors[i];
      IF instructor_name IS NOT NULL AND instructor_name <> '' THEN
        SELECT hourly_rate INTO hourly_rate_val
        FROM public.instructors
        WHERE name = instructor_name
        LIMIT 1;

        IF hourly_rate_val IS NOT NULL THEN
          total_expenses := total_expenses + hourly_rate_val;
        END IF;
      END IF;
    END IF;
  END LOOP;

  NEW.monthly_expenses := total_expenses;

  RETURN NEW;
END;
$function$;

-- Update sync_course_kpis_to_accounting to handle per-week instructors properly
CREATE OR REPLACE FUNCTION public.sync_course_kpis_to_accounting()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  month_names text[] := ARRAY['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                               'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  instructor_name text;
  total_expenses numeric;
  existing_transaction_id uuid;
  all_instructors text[];
  instr text;
BEGIN
  -- Handle DELETE: recalculate for all instructors in this month
  IF TG_OP = 'DELETE' THEN
    -- Get all unique instructors from this course (main + per-week)
    all_instructors := ARRAY(
      SELECT DISTINCT unnest(ARRAY[
        OLD.instructor,
        OLD.week1_instructor,
        OLD.week2_instructor,
        OLD.week3_instructor,
        OLD.week4_instructor,
        OLD.week5_instructor
      ]) WHERE unnest IS NOT NULL
    );
    
    FOREACH instr IN ARRAY all_instructors LOOP
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
    
    RETURN OLD;
  END IF;

  -- Handle INSERT/UPDATE: Get all unique instructors and update their totals
  all_instructors := ARRAY(
    SELECT DISTINCT unnest(ARRAY[
      NEW.instructor,
      NEW.week1_instructor,
      NEW.week2_instructor,
      NEW.week3_instructor,
      NEW.week4_instructor,
      NEW.week5_instructor
    ]) WHERE unnest IS NOT NULL AND unnest <> ''
  );
  
  FOREACH instr IN ARRAY all_instructors LOOP
    -- Calculate total expenses for this instructor in this month across all courses
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

  RETURN NEW;
END;
$function$;