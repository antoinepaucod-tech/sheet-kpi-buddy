-- Add subscription_end_date column to customer_members table
ALTER TABLE public.customer_members 
ADD COLUMN subscription_end_date DATE;

COMMENT ON COLUMN public.customer_members.subscription_end_date IS 'Date de fin d''abonnement pour les membres avec engagement (PIF, récurrents)';