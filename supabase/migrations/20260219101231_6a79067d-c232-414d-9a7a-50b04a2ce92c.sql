-- Create excluded_recurring_revenues table to track permanently deleted revenue transactions
CREATE TABLE IF NOT EXISTS public.excluded_recurring_revenues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add unique constraint to avoid duplicates
ALTER TABLE public.excluded_recurring_revenues 
  ADD CONSTRAINT excluded_recurring_revenues_category_client_unique 
  UNIQUE (category, client_name);

-- Enable RLS
ALTER TABLE public.excluded_recurring_revenues ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin and Staff can view excluded revenues"
  ON public.excluded_recurring_revenues FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admin and Staff can insert excluded revenues"
  ON public.excluded_recurring_revenues FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin can delete excluded revenues"
  ON public.excluded_recurring_revenues FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
