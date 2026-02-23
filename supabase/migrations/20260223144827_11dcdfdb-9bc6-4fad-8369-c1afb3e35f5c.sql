
-- Attach calculate_course_kpis trigger (BEFORE INSERT OR UPDATE)
CREATE TRIGGER trg_calculate_course_kpis
  BEFORE INSERT OR UPDATE ON public.course_kpis
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_course_kpis();

-- Attach sync_course_kpis_to_accounting trigger (AFTER INSERT, UPDATE, DELETE)
CREATE TRIGGER trg_sync_course_kpis_to_accounting
  AFTER INSERT OR UPDATE OR DELETE ON public.course_kpis
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_course_kpis_to_accounting();

-- Attach recalculate_instructor_courses trigger on instructors table
CREATE TRIGGER trg_recalculate_instructor_courses
  AFTER UPDATE ON public.instructors
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_instructor_courses();
