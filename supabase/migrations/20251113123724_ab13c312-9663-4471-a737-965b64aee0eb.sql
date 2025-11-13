-- Function to automatically calculate attendance_rate and monthly_expenses for course_kpis
CREATE OR REPLACE FUNCTION public.calculate_course_kpis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  weeks integer[];
  non_zero_weeks integer;
  total_attendance integer;
  max_capacity_val integer;
  hourly_rate_val numeric := 0;
BEGIN
  -- Build weeks array handling nulls as zeros
  weeks := ARRAY[
    COALESCE(NEW.week1_attendance, 0),
    COALESCE(NEW.week2_attendance, 0),
    COALESCE(NEW.week3_attendance, 0),
    COALESCE(NEW.week4_attendance, 0),
    COALESCE(NEW.week5_attendance, 0)
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

  -- Compute monthly expenses based on instructor hourly rate and weeks with attendance
  NEW.monthly_expenses := 0;
  IF NEW.instructor IS NOT NULL AND NEW.instructor <> '' THEN
    SELECT hourly_rate INTO hourly_rate_val
    FROM public.instructors
    WHERE name = NEW.instructor
    LIMIT 1;

    IF hourly_rate_val IS NOT NULL THEN
      NEW.monthly_expenses := (non_zero_weeks * hourly_rate_val);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to apply calculation before insert/update
DROP TRIGGER IF EXISTS calculate_course_kpis_before_write ON public.course_kpis;
CREATE TRIGGER calculate_course_kpis_before_write
BEFORE INSERT OR UPDATE OF week1_attendance, week2_attendance, week3_attendance, week4_attendance, week5_attendance, instructor, max_capacity
ON public.course_kpis
FOR EACH ROW
EXECUTE FUNCTION public.calculate_course_kpis();

-- Backfill: trigger recalculation on existing rows
UPDATE public.course_kpis
SET week1_attendance = COALESCE(week1_attendance, 0)
WHERE TRUE;