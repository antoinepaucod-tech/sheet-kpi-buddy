-- Add persons_count to customer_members
ALTER TABLE public.customer_members 
ADD COLUMN persons_count integer NOT NULL DEFAULT 1;

-- Create table for individual person details within a membership
CREATE TABLE public.member_persons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.customer_members(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  birth_date date,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.member_persons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin Staff and Coach can view member persons" 
ON public.member_persons 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role) OR has_role(auth.uid(), 'coach'::app_role));

CREATE POLICY "Admin and Staff can insert member persons" 
ON public.member_persons 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin and Staff can update member persons" 
ON public.member_persons 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin can delete member persons" 
ON public.member_persons 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_member_persons_updated_at
BEFORE UPDATE ON public.member_persons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();