-- Create member_comments table
CREATE TABLE public.member_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.customer_members(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL
);

-- Create member_onboarding_history table
CREATE TABLE public.member_onboarding_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.customer_members(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  previous_value BOOLEAN NOT NULL,
  new_value BOOLEAN NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.member_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_onboarding_history ENABLE ROW LEVEL SECURITY;

-- Policies for member_comments
CREATE POLICY "Anyone can view member comments" 
ON public.member_comments 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create member comments" 
ON public.member_comments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update member comments" 
ON public.member_comments 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete member comments" 
ON public.member_comments 
FOR DELETE 
USING (true);

-- Policies for member_onboarding_history
CREATE POLICY "Anyone can view onboarding history" 
ON public.member_onboarding_history 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create onboarding history" 
ON public.member_onboarding_history 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update onboarding history" 
ON public.member_onboarding_history 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete onboarding history" 
ON public.member_onboarding_history 
FOR DELETE 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_member_comments_member_id ON public.member_comments(member_id);
CREATE INDEX idx_member_comments_created_at ON public.member_comments(created_at);
CREATE INDEX idx_member_onboarding_history_member_id ON public.member_onboarding_history(member_id);
CREATE INDEX idx_member_onboarding_history_action_date ON public.member_onboarding_history(action_date);