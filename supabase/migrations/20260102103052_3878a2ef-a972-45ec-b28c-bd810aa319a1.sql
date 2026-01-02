-- Drop and recreate the calculate_course_kpis function with fixed syntax
CREATE OR REPLACE FUNCTION public.calculate_course_kpis()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total_attendance INTEGER;
  weeks_with_classes INTEGER;
  instructor_rate NUMERIC;
  week_expense NUMERIC;
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
  
  -- Count weeks that had classes (attendance > 0)
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
  
  -- Calculate expenses per week based on week-specific or default instructor
  -- Week 1
  week_instructor := COALESCE(NEW.week1_instructor, NEW.instructor);
  week_attendance := COALESCE(NEW.week1_attendance, 0);
  IF week_instructor IS NOT NULL AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE name = week_instructor LIMIT 1;
    IF instructor_rate IS NOT NULL THEN
      total_expenses := total_expenses + instructor_rate;
    END IF;
  END IF;
  
  -- Week 2
  week_instructor := COALESCE(NEW.week2_instructor, NEW.instructor);
  week_attendance := COALESCE(NEW.week2_attendance, 0);
  IF week_instructor IS NOT NULL AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE name = week_instructor LIMIT 1;
    IF instructor_rate IS NOT NULL THEN
      total_expenses := total_expenses + instructor_rate;
    END IF;
  END IF;
  
  -- Week 3
  week_instructor := COALESCE(NEW.week3_instructor, NEW.instructor);
  week_attendance := COALESCE(NEW.week3_attendance, 0);
  IF week_instructor IS NOT NULL AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE name = week_instructor LIMIT 1;
    IF instructor_rate IS NOT NULL THEN
      total_expenses := total_expenses + instructor_rate;
    END IF;
  END IF;
  
  -- Week 4
  week_instructor := COALESCE(NEW.week4_instructor, NEW.instructor);
  week_attendance := COALESCE(NEW.week4_attendance, 0);
  IF week_instructor IS NOT NULL AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE name = week_instructor LIMIT 1;
    IF instructor_rate IS NOT NULL THEN
      total_expenses := total_expenses + instructor_rate;
    END IF;
  END IF;
  
  -- Week 5
  week_instructor := COALESCE(NEW.week5_instructor, NEW.instructor);
  week_attendance := COALESCE(NEW.week5_attendance, 0);
  IF week_instructor IS NOT NULL AND week_attendance > 0 THEN
    SELECT COALESCE(hourly_rate, 0) INTO instructor_rate FROM public.instructors WHERE name = week_instructor LIMIT 1;
    IF instructor_rate IS NOT NULL THEN
      total_expenses := total_expenses + instructor_rate;
    END IF;
  END IF;
  
  NEW.monthly_expenses := total_expenses;
  
  RETURN NEW;
END;
$$;