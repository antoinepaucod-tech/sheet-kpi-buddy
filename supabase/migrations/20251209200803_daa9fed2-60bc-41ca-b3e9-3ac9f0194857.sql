-- Create table for weekly check-ins tracking for 6 weeks challenge members
CREATE TABLE public.challenge_weekly_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.customer_members(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 6),
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id, week_number)
);

-- Enable RLS
ALTER TABLE public.challenge_weekly_checkins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admin and Staff can view challenge checkins"
ON public.challenge_weekly_checkins
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admin and Staff can insert challenge checkins"
ON public.challenge_weekly_checkins
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin and Staff can update challenge checkins"
ON public.challenge_weekly_checkins
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin can delete challenge checkins"
ON public.challenge_weekly_checkins
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_challenge_weekly_checkins_updated_at
BEFORE UPDATE ON public.challenge_weekly_checkins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();