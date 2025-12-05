-- Drop existing permissive RLS policies and replace with role-based policies

-- accounting_transactions: Admin/Staff can manage, Viewer can only SELECT
DROP POLICY IF EXISTS "Authenticated users can delete accounting transactions" ON public.accounting_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert accounting transactions" ON public.accounting_transactions;
DROP POLICY IF EXISTS "Authenticated users can update accounting transactions" ON public.accounting_transactions;
DROP POLICY IF EXISTS "Authenticated users can view accounting transactions" ON public.accounting_transactions;

CREATE POLICY "Admin and Staff can view accounting transactions" 
ON public.accounting_transactions FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert accounting transactions" 
ON public.accounting_transactions FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update accounting transactions" 
ON public.accounting_transactions FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete accounting transactions" 
ON public.accounting_transactions FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- customer_members: Admin/Staff can manage, Viewer can only SELECT
DROP POLICY IF EXISTS "Authenticated users can delete customer members" ON public.customer_members;
DROP POLICY IF EXISTS "Authenticated users can insert customer members" ON public.customer_members;
DROP POLICY IF EXISTS "Authenticated users can update customer members" ON public.customer_members;
DROP POLICY IF EXISTS "Authenticated users can view customer members" ON public.customer_members;

CREATE POLICY "Admin and Staff can view customer members" 
ON public.customer_members FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert customer members" 
ON public.customer_members FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update customer members" 
ON public.customer_members FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete customer members" 
ON public.customer_members FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- monthly_kpis: Admin/Staff can manage, Viewer can only SELECT
DROP POLICY IF EXISTS "Authenticated users can delete monthly KPIs" ON public.monthly_kpis;
DROP POLICY IF EXISTS "Authenticated users can insert monthly KPIs" ON public.monthly_kpis;
DROP POLICY IF EXISTS "Authenticated users can update monthly KPIs" ON public.monthly_kpis;
DROP POLICY IF EXISTS "Authenticated users can view monthly KPIs" ON public.monthly_kpis;

CREATE POLICY "Admin and Staff can view monthly KPIs" 
ON public.monthly_kpis FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert monthly KPIs" 
ON public.monthly_kpis FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update monthly KPIs" 
ON public.monthly_kpis FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete monthly KPIs" 
ON public.monthly_kpis FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- course_kpis: Admin/Staff can manage, Viewer can only SELECT
DROP POLICY IF EXISTS "Authenticated users can delete course KPIs" ON public.course_kpis;
DROP POLICY IF EXISTS "Authenticated users can insert course KPIs" ON public.course_kpis;
DROP POLICY IF EXISTS "Authenticated users can update course KPIs" ON public.course_kpis;
DROP POLICY IF EXISTS "Authenticated users can view course KPIs" ON public.course_kpis;

CREATE POLICY "Admin and Staff can view course KPIs" 
ON public.course_kpis FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert course KPIs" 
ON public.course_kpis FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update course KPIs" 
ON public.course_kpis FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete course KPIs" 
ON public.course_kpis FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- recurring_transactions: Admin/Staff can manage, Viewer can only SELECT
DROP POLICY IF EXISTS "Authenticated users can delete recurring transactions" ON public.recurring_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert recurring transactions" ON public.recurring_transactions;
DROP POLICY IF EXISTS "Authenticated users can update recurring transactions" ON public.recurring_transactions;
DROP POLICY IF EXISTS "Authenticated users can view recurring transactions" ON public.recurring_transactions;

CREATE POLICY "Admin and Staff can view recurring transactions" 
ON public.recurring_transactions FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert recurring transactions" 
ON public.recurring_transactions FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update recurring transactions" 
ON public.recurring_transactions FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete recurring transactions" 
ON public.recurring_transactions FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- accounting_categories: Admin/Staff can manage, Viewer can only SELECT
DROP POLICY IF EXISTS "Authenticated users can delete accounting categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Authenticated users can insert accounting categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Authenticated users can update accounting categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Authenticated users can view accounting categories" ON public.accounting_categories;

CREATE POLICY "Admin and Staff can view accounting categories" 
ON public.accounting_categories FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert accounting categories" 
ON public.accounting_categories FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update accounting categories" 
ON public.accounting_categories FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete accounting categories" 
ON public.accounting_categories FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- instructors: Admin/Staff can manage, Viewer can only SELECT
DROP POLICY IF EXISTS "Authenticated users can delete instructors" ON public.instructors;
DROP POLICY IF EXISTS "Authenticated users can insert instructors" ON public.instructors;
DROP POLICY IF EXISTS "Authenticated users can update instructors" ON public.instructors;
DROP POLICY IF EXISTS "Authenticated users can view instructors" ON public.instructors;

CREATE POLICY "Admin and Staff can view instructors" 
ON public.instructors FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert instructors" 
ON public.instructors FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update instructors" 
ON public.instructors FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete instructors" 
ON public.instructors FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- course_templates: Admin/Staff can manage, Viewer can only SELECT
DROP POLICY IF EXISTS "Authenticated users can delete course templates" ON public.course_templates;
DROP POLICY IF EXISTS "Authenticated users can insert course templates" ON public.course_templates;
DROP POLICY IF EXISTS "Authenticated users can update course templates" ON public.course_templates;
DROP POLICY IF EXISTS "Authenticated users can view course templates" ON public.course_templates;

CREATE POLICY "Admin and Staff can view course templates" 
ON public.course_templates FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert course templates" 
ON public.course_templates FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update course templates" 
ON public.course_templates FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete course templates" 
ON public.course_templates FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- schedule_templates: Admin/Staff can manage, Viewer can only SELECT
DROP POLICY IF EXISTS "Authenticated users can delete schedule templates" ON public.schedule_templates;
DROP POLICY IF EXISTS "Authenticated users can insert schedule templates" ON public.schedule_templates;
DROP POLICY IF EXISTS "Authenticated users can update schedule templates" ON public.schedule_templates;
DROP POLICY IF EXISTS "Authenticated users can view schedule templates" ON public.schedule_templates;

CREATE POLICY "Admin and Staff can view schedule templates" 
ON public.schedule_templates FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert schedule templates" 
ON public.schedule_templates FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update schedule templates" 
ON public.schedule_templates FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete schedule templates" 
ON public.schedule_templates FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- tutorials: Admin/Staff can manage, Viewer can only SELECT
DROP POLICY IF EXISTS "Authenticated users can create tutorials" ON public.tutorials;
DROP POLICY IF EXISTS "Authenticated users can delete tutorials" ON public.tutorials;
DROP POLICY IF EXISTS "Authenticated users can update tutorials" ON public.tutorials;
DROP POLICY IF EXISTS "Authenticated users can view tutorials" ON public.tutorials;

CREATE POLICY "Admin and Staff can view tutorials" 
ON public.tutorials FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert tutorials" 
ON public.tutorials FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update tutorials" 
ON public.tutorials FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete tutorials" 
ON public.tutorials FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- tutorial_views: Users can manage their own views
DROP POLICY IF EXISTS "Authenticated users can create tutorial views" ON public.tutorial_views;
DROP POLICY IF EXISTS "Authenticated users can delete tutorial views" ON public.tutorial_views;
DROP POLICY IF EXISTS "Authenticated users can update tutorial views" ON public.tutorial_views;
DROP POLICY IF EXISTS "Authenticated users can view tutorial views" ON public.tutorial_views;

CREATE POLICY "Users can view their own tutorial views" 
ON public.tutorial_views FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tutorial views" 
ON public.tutorial_views FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tutorial views" 
ON public.tutorial_views FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tutorial views" 
ON public.tutorial_views FOR DELETE 
USING (auth.uid() = user_id);

-- member_comments: Admin/Staff can manage
DROP POLICY IF EXISTS "Authenticated users can create member comments" ON public.member_comments;
DROP POLICY IF EXISTS "Authenticated users can delete member comments" ON public.member_comments;
DROP POLICY IF EXISTS "Authenticated users can update member comments" ON public.member_comments;
DROP POLICY IF EXISTS "Authenticated users can view member comments" ON public.member_comments;

CREATE POLICY "Admin and Staff can view member comments" 
ON public.member_comments FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert member comments" 
ON public.member_comments FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update member comments" 
ON public.member_comments FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete member comments" 
ON public.member_comments FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- member_onboarding_history: Admin/Staff can manage
DROP POLICY IF EXISTS "Authenticated users can create onboarding history" ON public.member_onboarding_history;
DROP POLICY IF EXISTS "Authenticated users can delete onboarding history" ON public.member_onboarding_history;
DROP POLICY IF EXISTS "Authenticated users can update onboarding history" ON public.member_onboarding_history;
DROP POLICY IF EXISTS "Authenticated users can view onboarding history" ON public.member_onboarding_history;

CREATE POLICY "Admin and Staff can view onboarding history" 
ON public.member_onboarding_history FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert onboarding history" 
ON public.member_onboarding_history FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update onboarding history" 
ON public.member_onboarding_history FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete onboarding history" 
ON public.member_onboarding_history FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- weekly_trainings: Admin/Staff can manage
DROP POLICY IF EXISTS "Authenticated users can insert weekly trainings" ON public.weekly_trainings;
DROP POLICY IF EXISTS "Authenticated users can update weekly trainings" ON public.weekly_trainings;
DROP POLICY IF EXISTS "Authenticated users can view weekly trainings" ON public.weekly_trainings;

CREATE POLICY "Admin and Staff can view weekly trainings" 
ON public.weekly_trainings FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admin and Staff can insert weekly trainings" 
ON public.weekly_trainings FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin and Staff can update weekly trainings" 
ON public.weekly_trainings FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete weekly trainings" 
ON public.weekly_trainings FOR DELETE 
USING (has_role(auth.uid(), 'admin'));