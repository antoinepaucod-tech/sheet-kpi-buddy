-- Add user_id column to email_preferences table
ALTER TABLE public.email_preferences 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage email preferences" ON public.email_preferences;
DROP POLICY IF EXISTS "Authenticated users can view email preferences" ON public.email_preferences;

-- Create new user-scoped RLS policies
CREATE POLICY "Users can view their own email preferences" 
ON public.email_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email preferences" 
ON public.email_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email preferences" 
ON public.email_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email preferences" 
ON public.email_preferences 
FOR DELETE 
USING (auth.uid() = user_id);