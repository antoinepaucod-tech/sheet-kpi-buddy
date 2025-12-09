-- Add performed_by column to track who validated each onboarding step
ALTER TABLE public.member_onboarding_history 
ADD COLUMN performed_by text;