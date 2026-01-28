-- Create table to track excluded recurring expenses
CREATE TABLE public.excluded_recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  category TEXT NOT NULL,
  service_description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(year, month, category, service_description)
);

-- Enable RLS
ALTER TABLE public.excluded_recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admin and Staff can view excluded expenses"
ON public.excluded_recurring_expenses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admin and Staff can insert excluded expenses"
ON public.excluded_recurring_expenses
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin can delete excluded expenses"
ON public.excluded_recurring_expenses
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));