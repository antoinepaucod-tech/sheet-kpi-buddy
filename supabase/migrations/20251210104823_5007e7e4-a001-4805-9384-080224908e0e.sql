-- Create helper functions for coach role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_coach(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'coach'
  )
$$;

-- Update RLS policies to include coach role for tables they need access to

-- customer_members: Add coach to SELECT
DROP POLICY IF EXISTS "Admin and Staff can view customer members" ON public.customer_members;
CREATE POLICY "Admin Staff and Coach can view customer members" 
ON public.customer_members 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

-- weekly_trainings: Add coach to all operations
DROP POLICY IF EXISTS "Admin and Staff can view weekly trainings" ON public.weekly_trainings;
CREATE POLICY "Admin Staff and Coach can view weekly trainings" 
ON public.weekly_trainings 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

DROP POLICY IF EXISTS "Admin and Staff can insert weekly trainings" ON public.weekly_trainings;
CREATE POLICY "Admin Staff and Coach can insert weekly trainings" 
ON public.weekly_trainings 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

DROP POLICY IF EXISTS "Admin and Staff can update weekly trainings" ON public.weekly_trainings;
CREATE POLICY "Admin Staff and Coach can update weekly trainings" 
ON public.weekly_trainings 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

-- challenge_weekly_checkins: Add coach to all operations
DROP POLICY IF EXISTS "Admin and Staff can view challenge checkins" ON public.challenge_weekly_checkins;
CREATE POLICY "Admin Staff and Coach can view challenge checkins" 
ON public.challenge_weekly_checkins 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

DROP POLICY IF EXISTS "Admin and Staff can insert challenge checkins" ON public.challenge_weekly_checkins;
CREATE POLICY "Admin Staff and Coach can insert challenge checkins" 
ON public.challenge_weekly_checkins 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

DROP POLICY IF EXISTS "Admin and Staff can update challenge checkins" ON public.challenge_weekly_checkins;
CREATE POLICY "Admin Staff and Coach can update challenge checkins" 
ON public.challenge_weekly_checkins 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

-- course_kpis: Add coach to SELECT, INSERT, UPDATE
DROP POLICY IF EXISTS "Admin and Staff can view course KPIs" ON public.course_kpis;
CREATE POLICY "Admin Staff and Coach can view course KPIs" 
ON public.course_kpis 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

DROP POLICY IF EXISTS "Admin and Staff can insert course KPIs" ON public.course_kpis;
CREATE POLICY "Admin Staff and Coach can insert course KPIs" 
ON public.course_kpis 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

DROP POLICY IF EXISTS "Admin and Staff can update course KPIs" ON public.course_kpis;
CREATE POLICY "Admin Staff and Coach can update course KPIs" 
ON public.course_kpis 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

-- schedule_templates: Add coach to SELECT
DROP POLICY IF EXISTS "Admin and Staff can view schedule templates" ON public.schedule_templates;
CREATE POLICY "Admin Staff and Coach can view schedule templates" 
ON public.schedule_templates 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

-- tutorials: Add coach to SELECT
DROP POLICY IF EXISTS "Admin and Staff can view tutorials" ON public.tutorials;
CREATE POLICY "Admin Staff and Coach can view tutorials" 
ON public.tutorials 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

-- instructors: Add coach to SELECT
DROP POLICY IF EXISTS "Admin and Staff can view instructors" ON public.instructors;
CREATE POLICY "Admin Staff and Coach can view instructors" 
ON public.instructors 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

-- course_templates: Add coach to SELECT
DROP POLICY IF EXISTS "Admin and Staff can view course templates" ON public.course_templates;
CREATE POLICY "Admin Staff and Coach can view course templates" 
ON public.course_templates 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'coach'::app_role));