-- Function to recalculate course expenses when instructor hourly rate changes
CREATE OR REPLACE FUNCTION public.recalculate_instructor_courses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When hourly_rate is updated, trigger an update on all courses for this instructor
  -- This will cause the calculate_course_kpis trigger to recalculate monthly_expenses
  IF OLD.hourly_rate IS DISTINCT FROM NEW.hourly_rate THEN
    UPDATE course_kpis
    SET updated_at = now()
    WHERE instructor = NEW.name;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Trigger to recalculate courses when instructor hourly rate changes
DROP TRIGGER IF EXISTS recalculate_instructor_courses_trigger ON public.instructors;
CREATE TRIGGER recalculate_instructor_courses_trigger
  AFTER UPDATE ON public.instructors
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_instructor_courses();