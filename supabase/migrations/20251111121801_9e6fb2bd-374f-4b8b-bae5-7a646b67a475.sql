-- Create customer_members table
CREATE TABLE public.customer_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  membership TEXT NOT NULL,
  onboarding_bsport BOOLEAN NOT NULL DEFAULT false,
  onboarding_hubfit BOOLEAN NOT NULL DEFAULT false,
  onboarding_nutrition BOOLEAN NOT NULL DEFAULT false,
  questionnaire_coaching BOOLEAN NOT NULL DEFAULT false,
  session_introduction BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create weekly_trainings table
CREATE TABLE public.weekly_trainings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.customer_members(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 52),
  trainings_count INTEGER NOT NULL DEFAULT 0 CHECK (trainings_count >= 0 AND trainings_count <= 3),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id, week_number)
);

-- Enable Row Level Security
ALTER TABLE public.customer_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_trainings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customer_members (allow all operations for everyone)
CREATE POLICY "Anyone can view customer members"
  ON public.customer_members
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert customer members"
  ON public.customer_members
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update customer members"
  ON public.customer_members
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete customer members"
  ON public.customer_members
  FOR DELETE
  USING (true);

-- Create RLS policies for weekly_trainings (allow all operations for everyone)
CREATE POLICY "Anyone can view weekly trainings"
  ON public.weekly_trainings
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert weekly trainings"
  ON public.weekly_trainings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update weekly trainings"
  ON public.weekly_trainings
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete weekly trainings"
  ON public.weekly_trainings
  FOR DELETE
  USING (true);

-- Create triggers for updating updated_at timestamp
CREATE TRIGGER update_customer_members_updated_at
  BEFORE UPDATE ON public.customer_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weekly_trainings_updated_at
  BEFORE UPDATE ON public.weekly_trainings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();