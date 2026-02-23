
-- Fix the calculate_course_kpis function to use flexible name matching (TRIM + ILIKE prefix)
CREATE OR REPLACE FUNCTION public.calculate_course_kpis()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  
  -- Calculate expenses: for each week, use week-specific instructor if set, otherwise default
  -- Use flexible matching: TRIM + ILIKE prefix to handle partial names and trailing spaces
  
  -- Week 1
  week_instructor := TRIM(COALESCE(NULLIF(NEW.week1_instructor, ''), NEW.instructor));
  week_attendance := COALESCE(NEW.week1_attendance, 0);
  IF week_instructor IS NOT NULL AND week_instructor != '' AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE TRIM(name) ILIKE week_instructor || '%' LIMIT 1;
    IF instructor_rate IS NOT NULL THEN total_expenses := total_expenses + instructor_rate; END IF;
  END IF;
  
  -- Week 2
  week_instructor := TRIM(COALESCE(NULLIF(NEW.week2_instructor, ''), NEW.instructor));
  week_attendance := COALESCE(NEW.week2_attendance, 0);
  IF week_instructor IS NOT NULL AND week_instructor != '' AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE TRIM(name) ILIKE week_instructor || '%' LIMIT 1;
    IF instructor_rate IS NOT NULL THEN total_expenses := total_expenses + instructor_rate; END IF;
  END IF;
  
  -- Week 3
  week_instructor := TRIM(COALESCE(NULLIF(NEW.week3_instructor, ''), NEW.instructor));
  week_attendance := COALESCE(NEW.week3_attendance, 0);
  IF week_instructor IS NOT NULL AND week_instructor != '' AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE TRIM(name) ILIKE week_instructor || '%' LIMIT 1;
    IF instructor_rate IS NOT NULL THEN total_expenses := total_expenses + instructor_rate; END IF;
  END IF;
  
  -- Week 4
  week_instructor := TRIM(COALESCE(NULLIF(NEW.week4_instructor, ''), NEW.instructor));
  week_attendance := COALESCE(NEW.week4_attendance, 0);
  IF week_instructor IS NOT NULL AND week_instructor != '' AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE TRIM(name) ILIKE week_instructor || '%' LIMIT 1;
    IF instructor_rate IS NOT NULL THEN total_expenses := total_expenses + instructor_rate; END IF;
  END IF;
  
  -- Week 5
  week_instructor := TRIM(COALESCE(NULLIF(NEW.week5_instructor, ''), NEW.instructor));
  week_attendance := COALESCE(NEW.week5_attendance, 0);
  IF week_instructor IS NOT NULL AND week_instructor != '' AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE TRIM(name) ILIKE week_instructor || '%' LIMIT 1;
    IF instructor_rate IS NOT NULL THEN total_expenses := total_expenses + instructor_rate; END IF;
  END IF;
  
  NEW.monthly_expenses := total_expenses;
  
  RETURN NEW;
END;
$function$;

-- Also fix sync_course_kpis_to_accounting to use flexible matching
CREATE OR REPLACE FUNCTION public.sync_course_kpis_to_accounting()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  month_names text[] := ARRAY['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                               'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  instr text;
  instructor_total numeric;
  existing_transaction_id uuid;
  all_instructors text[];
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    SELECT ARRAY_AGG(DISTINCT instructor_name) INTO all_instructors
    FROM (
      SELECT instructor AS instructor_name FROM course_kpis WHERE year = OLD.year AND month = OLD.month AND id != OLD.id AND instructor IS NOT NULL
      UNION
      SELECT week1_instructor FROM course_kpis WHERE year = OLD.year AND month = OLD.month AND id != OLD.id AND week1_instructor IS NOT NULL
      UNION
      SELECT week2_instructor FROM course_kpis WHERE year = OLD.year AND month = OLD.month AND id != OLD.id AND week2_instructor IS NOT NULL
      UNION
      SELECT week3_instructor FROM course_kpis WHERE year = OLD.year AND month = OLD.month AND id != OLD.id AND week3_instructor IS NOT NULL
      UNION
      SELECT week4_instructor FROM course_kpis WHERE year = OLD.year AND month = OLD.month AND id != OLD.id AND week4_instructor IS NOT NULL
      UNION
      SELECT week5_instructor FROM course_kpis WHERE year = OLD.year AND month = OLD.month AND id != OLD.id AND week5_instructor IS NOT NULL
    ) AS instructors;
    
    DELETE FROM accounting_transactions 
    WHERE year = OLD.year 
      AND month = OLD.month 
      AND category = 'SALAIRES COACH' 
      AND notes = 'Synchronisé depuis KPI Cours'
      AND (all_instructors IS NULL OR NOT (client_name = ANY(all_instructors)));
    
    RETURN OLD;
  END IF;

  -- For INSERT/UPDATE: Get all unique instructors for this month
  SELECT ARRAY_AGG(DISTINCT instructor_name) INTO all_instructors
  FROM (
    SELECT instructor AS instructor_name FROM course_kpis WHERE year = NEW.year AND month = NEW.month AND instructor IS NOT NULL AND instructor != ''
    UNION
    SELECT week1_instructor FROM course_kpis WHERE year = NEW.year AND month = NEW.month AND week1_instructor IS NOT NULL AND week1_instructor != ''
    UNION
    SELECT week2_instructor FROM course_kpis WHERE year = NEW.year AND month = NEW.month AND week2_instructor IS NOT NULL AND week2_instructor != ''
    UNION
    SELECT week3_instructor FROM course_kpis WHERE year = NEW.year AND month = NEW.month AND week3_instructor IS NOT NULL AND week3_instructor != ''
    UNION
    SELECT week4_instructor FROM course_kpis WHERE year = NEW.year AND month = NEW.month AND week4_instructor IS NOT NULL AND week4_instructor != ''
    UNION
    SELECT week5_instructor FROM course_kpis WHERE year = NEW.year AND month = NEW.month AND week5_instructor IS NOT NULL AND week5_instructor != ''
  ) AS instructors;

  -- Process each instructor
  IF all_instructors IS NOT NULL THEN
    FOREACH instr IN ARRAY all_instructors LOOP
      -- Calculate total for this instructor using flexible name matching
      SELECT COALESCE(SUM(week_total), 0) INTO instructor_total
      FROM (
        SELECT 
          CASE WHEN TRIM(COALESCE(week1_instructor, instructor)) = TRIM(instr) AND COALESCE(week1_attendance, 0) > 0 
               THEN (SELECT COALESCE(hourly_rate, 0) FROM instructors WHERE TRIM(name) ILIKE TRIM(instr) || '%' LIMIT 1) ELSE 0 END +
          CASE WHEN TRIM(COALESCE(week2_instructor, instructor)) = TRIM(instr) AND COALESCE(week2_attendance, 0) > 0 
               THEN (SELECT COALESCE(hourly_rate, 0) FROM instructors WHERE TRIM(name) ILIKE TRIM(instr) || '%' LIMIT 1) ELSE 0 END +
          CASE WHEN TRIM(COALESCE(week3_instructor, instructor)) = TRIM(instr) AND COALESCE(week3_attendance, 0) > 0 
               THEN (SELECT COALESCE(hourly_rate, 0) FROM instructors WHERE TRIM(name) ILIKE TRIM(instr) || '%' LIMIT 1) ELSE 0 END +
          CASE WHEN TRIM(COALESCE(week4_instructor, instructor)) = TRIM(instr) AND COALESCE(week4_attendance, 0) > 0 
               THEN (SELECT COALESCE(hourly_rate, 0) FROM instructors WHERE TRIM(name) ILIKE TRIM(instr) || '%' LIMIT 1) ELSE 0 END +
          CASE WHEN TRIM(COALESCE(week5_instructor, instructor)) = TRIM(instr) AND COALESCE(week5_attendance, 0) > 0 
               THEN (SELECT COALESCE(hourly_rate, 0) FROM instructors WHERE TRIM(name) ILIKE TRIM(instr) || '%' LIMIT 1) ELSE 0 END
          AS week_total
        FROM course_kpis
        WHERE year = NEW.year AND month = NEW.month
      ) AS totals;

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
        IF instructor_total > 0 THEN
          UPDATE accounting_transactions
          SET amount = instructor_total,
              amount_received = instructor_total,
              transaction_date = make_date(NEW.year, NEW.month, 1)
          WHERE id = existing_transaction_id;
        ELSE
          DELETE FROM accounting_transactions WHERE id = existing_transaction_id;
        END IF;
      ELSE
        IF instructor_total > 0 THEN
          INSERT INTO accounting_transactions (
            transaction_type, category, client_name, service_description,
            amount, amount_received, transaction_date, year, month, month_name,
            is_validated, is_auto_generated, notes
          ) VALUES (
            'expense', 'SALAIRES COACH', instr, 'cours collectif',
            instructor_total, instructor_total, make_date(NEW.year, NEW.month, 1),
            NEW.year, NEW.month, month_names[NEW.month],
            true, true, 'Synchronisé depuis KPI Cours'
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Clean up entries for instructors no longer teaching this month
  DELETE FROM accounting_transactions 
  WHERE year = NEW.year 
    AND month = NEW.month 
    AND category = 'SALAIRES COACH' 
    AND notes = 'Synchronisé depuis KPI Cours'
    AND (all_instructors IS NULL OR NOT (client_name = ANY(all_instructors)));

  RETURN NEW;
END;
$function$;
