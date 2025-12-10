-- Create table for tracking subscription renewals
CREATE TABLE public.member_renewal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.customer_members(id) ON DELETE CASCADE,
  renewal_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  previous_end_date DATE NOT NULL,
  new_end_date DATE NOT NULL,
  renewal_duration TEXT NOT NULL,
  performed_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.member_renewal_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin and Staff can view renewal history"
  ON public.member_renewal_history
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admin and Staff can insert renewal history"
  ON public.member_renewal_history
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin can delete renewal history"
  ON public.member_renewal_history
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for faster lookups
CREATE INDEX idx_member_renewal_history_member_id ON public.member_renewal_history(member_id);
CREATE INDEX idx_member_renewal_history_date ON public.member_renewal_history(renewal_date DESC);