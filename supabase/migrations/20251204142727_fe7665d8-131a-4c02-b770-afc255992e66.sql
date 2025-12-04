-- Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'viewer');

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
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
      AND role = _role
  )
$$;

-- Function to check if user is authenticated
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'authenticated'
$$;

-- RLS policy for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Fix the sync_cash_collected_to_monthly_kpis function search_path
ALTER FUNCTION public.sync_cash_collected_to_monthly_kpis() SET search_path = public;

-- Drop all existing permissive policies and create authenticated-only policies

-- accounting_categories
DROP POLICY IF EXISTS "Anyone can delete accounting categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Anyone can insert accounting categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Anyone can update accounting categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Anyone can view accounting categories" ON public.accounting_categories;

CREATE POLICY "Authenticated users can view accounting categories" ON public.accounting_categories FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert accounting categories" ON public.accounting_categories FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update accounting categories" ON public.accounting_categories FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete accounting categories" ON public.accounting_categories FOR DELETE USING (public.is_authenticated());

-- accounting_transactions
DROP POLICY IF EXISTS "Anyone can delete accounting transactions" ON public.accounting_transactions;
DROP POLICY IF EXISTS "Anyone can insert accounting transactions" ON public.accounting_transactions;
DROP POLICY IF EXISTS "Anyone can update accounting transactions" ON public.accounting_transactions;
DROP POLICY IF EXISTS "Anyone can view accounting transactions" ON public.accounting_transactions;

CREATE POLICY "Authenticated users can view accounting transactions" ON public.accounting_transactions FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert accounting transactions" ON public.accounting_transactions FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update accounting transactions" ON public.accounting_transactions FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete accounting transactions" ON public.accounting_transactions FOR DELETE USING (public.is_authenticated());

-- course_kpis
DROP POLICY IF EXISTS "Anyone can delete course KPIs" ON public.course_kpis;
DROP POLICY IF EXISTS "Anyone can insert course KPIs" ON public.course_kpis;
DROP POLICY IF EXISTS "Anyone can update course KPIs" ON public.course_kpis;
DROP POLICY IF EXISTS "Anyone can view course KPIs" ON public.course_kpis;

CREATE POLICY "Authenticated users can view course KPIs" ON public.course_kpis FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert course KPIs" ON public.course_kpis FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update course KPIs" ON public.course_kpis FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete course KPIs" ON public.course_kpis FOR DELETE USING (public.is_authenticated());

-- course_templates
DROP POLICY IF EXISTS "Anyone can delete course templates" ON public.course_templates;
DROP POLICY IF EXISTS "Anyone can insert course templates" ON public.course_templates;
DROP POLICY IF EXISTS "Anyone can update course templates" ON public.course_templates;
DROP POLICY IF EXISTS "Anyone can view course templates" ON public.course_templates;

CREATE POLICY "Authenticated users can view course templates" ON public.course_templates FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert course templates" ON public.course_templates FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update course templates" ON public.course_templates FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete course templates" ON public.course_templates FOR DELETE USING (public.is_authenticated());

-- customer_members
DROP POLICY IF EXISTS "Anyone can delete customer members" ON public.customer_members;
DROP POLICY IF EXISTS "Anyone can insert customer members" ON public.customer_members;
DROP POLICY IF EXISTS "Anyone can update customer members" ON public.customer_members;
DROP POLICY IF EXISTS "Anyone can view customer members" ON public.customer_members;

CREATE POLICY "Authenticated users can view customer members" ON public.customer_members FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert customer members" ON public.customer_members FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update customer members" ON public.customer_members FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete customer members" ON public.customer_members FOR DELETE USING (public.is_authenticated());

-- email_preferences
DROP POLICY IF EXISTS "Anyone can manage email preferences" ON public.email_preferences;
DROP POLICY IF EXISTS "Anyone can view email preferences" ON public.email_preferences;

CREATE POLICY "Authenticated users can view email preferences" ON public.email_preferences FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can manage email preferences" ON public.email_preferences FOR ALL USING (public.is_authenticated()) WITH CHECK (public.is_authenticated());

-- instructors
DROP POLICY IF EXISTS "Anyone can delete instructors" ON public.instructors;
DROP POLICY IF EXISTS "Anyone can insert instructors" ON public.instructors;
DROP POLICY IF EXISTS "Anyone can update instructors" ON public.instructors;
DROP POLICY IF EXISTS "Anyone can view instructors" ON public.instructors;

CREATE POLICY "Authenticated users can view instructors" ON public.instructors FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert instructors" ON public.instructors FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update instructors" ON public.instructors FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete instructors" ON public.instructors FOR DELETE USING (public.is_authenticated());

-- member_comments
DROP POLICY IF EXISTS "Anyone can create member comments" ON public.member_comments;
DROP POLICY IF EXISTS "Anyone can delete member comments" ON public.member_comments;
DROP POLICY IF EXISTS "Anyone can update member comments" ON public.member_comments;
DROP POLICY IF EXISTS "Anyone can view member comments" ON public.member_comments;

CREATE POLICY "Authenticated users can view member comments" ON public.member_comments FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create member comments" ON public.member_comments FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update member comments" ON public.member_comments FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete member comments" ON public.member_comments FOR DELETE USING (public.is_authenticated());

-- member_onboarding_history
DROP POLICY IF EXISTS "Anyone can create onboarding history" ON public.member_onboarding_history;
DROP POLICY IF EXISTS "Anyone can delete onboarding history" ON public.member_onboarding_history;
DROP POLICY IF EXISTS "Anyone can update onboarding history" ON public.member_onboarding_history;
DROP POLICY IF EXISTS "Anyone can view onboarding history" ON public.member_onboarding_history;

CREATE POLICY "Authenticated users can view onboarding history" ON public.member_onboarding_history FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create onboarding history" ON public.member_onboarding_history FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update onboarding history" ON public.member_onboarding_history FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete onboarding history" ON public.member_onboarding_history FOR DELETE USING (public.is_authenticated());

-- monthly_kpis
DROP POLICY IF EXISTS "Anyone can delete monthly KPIs" ON public.monthly_kpis;
DROP POLICY IF EXISTS "Anyone can insert monthly KPIs" ON public.monthly_kpis;
DROP POLICY IF EXISTS "Anyone can update monthly KPIs" ON public.monthly_kpis;
DROP POLICY IF EXISTS "Anyone can view monthly KPIs" ON public.monthly_kpis;

CREATE POLICY "Authenticated users can view monthly KPIs" ON public.monthly_kpis FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert monthly KPIs" ON public.monthly_kpis FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update monthly KPIs" ON public.monthly_kpis FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete monthly KPIs" ON public.monthly_kpis FOR DELETE USING (public.is_authenticated());

-- recurring_transactions
DROP POLICY IF EXISTS "Anyone can delete recurring transactions" ON public.recurring_transactions;
DROP POLICY IF EXISTS "Anyone can insert recurring transactions" ON public.recurring_transactions;
DROP POLICY IF EXISTS "Anyone can update recurring transactions" ON public.recurring_transactions;
DROP POLICY IF EXISTS "Anyone can view recurring transactions" ON public.recurring_transactions;

CREATE POLICY "Authenticated users can view recurring transactions" ON public.recurring_transactions FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert recurring transactions" ON public.recurring_transactions FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update recurring transactions" ON public.recurring_transactions FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete recurring transactions" ON public.recurring_transactions FOR DELETE USING (public.is_authenticated());

-- schedule_templates
DROP POLICY IF EXISTS "Anyone can delete schedule templates" ON public.schedule_templates;
DROP POLICY IF EXISTS "Anyone can insert schedule templates" ON public.schedule_templates;
DROP POLICY IF EXISTS "Anyone can update schedule templates" ON public.schedule_templates;
DROP POLICY IF EXISTS "Anyone can view schedule templates" ON public.schedule_templates;

CREATE POLICY "Authenticated users can view schedule templates" ON public.schedule_templates FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert schedule templates" ON public.schedule_templates FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update schedule templates" ON public.schedule_templates FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete schedule templates" ON public.schedule_templates FOR DELETE USING (public.is_authenticated());

-- tutorials
DROP POLICY IF EXISTS "Tutorials are viewable by everyone" ON public.tutorials;
DROP POLICY IF EXISTS "Tutorials can be created by anyone" ON public.tutorials;
DROP POLICY IF EXISTS "Tutorials can be deleted by anyone" ON public.tutorials;
DROP POLICY IF EXISTS "Tutorials can be updated by anyone" ON public.tutorials;

CREATE POLICY "Authenticated users can view tutorials" ON public.tutorials FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create tutorials" ON public.tutorials FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update tutorials" ON public.tutorials FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete tutorials" ON public.tutorials FOR DELETE USING (public.is_authenticated());

-- tutorial_views
DROP POLICY IF EXISTS "Users can create their own tutorial views" ON public.tutorial_views;
DROP POLICY IF EXISTS "Users can delete their own tutorial views" ON public.tutorial_views;
DROP POLICY IF EXISTS "Users can update their own tutorial views" ON public.tutorial_views;
DROP POLICY IF EXISTS "Users can view their own tutorial views" ON public.tutorial_views;

CREATE POLICY "Authenticated users can view tutorial views" ON public.tutorial_views FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can create tutorial views" ON public.tutorial_views FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update tutorial views" ON public.tutorial_views FOR UPDATE USING (public.is_authenticated());
CREATE POLICY "Authenticated users can delete tutorial views" ON public.tutorial_views FOR DELETE USING (public.is_authenticated());

-- weekly_trainings
DROP POLICY IF EXISTS "Anyone can delete weekly trainings" ON public.weekly_trainings;
DROP POLICY IF EXISTS "Anyone can insert weekly trainings" ON public.weekly_trainings;
DROP POLICY IF EXISTS "Anyone can update weekly trainings" ON public.weekly_trainings;
DROP POLICY IF EXISTS "Anyone can view weekly trainings" ON public.weekly_trainings;

CREATE POLICY "Authenticated users can view weekly trainings" ON public.weekly_trainings FOR SELECT USING (public.is_authenticated());
CREATE POLICY "Authenticated users can insert weekly trainings" ON public.weekly_trainings FOR INSERT WITH CHECK (public.is_authenticated());
CREATE POLICY "Authenticated users can update weekly trainings" ON public.weekly_trainings FOR UPDATE USING (public.is_authenticated());