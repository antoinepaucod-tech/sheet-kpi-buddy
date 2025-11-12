-- Add member_type and cash_collected columns to customer_members table
ALTER TABLE public.customer_members 
ADD COLUMN IF NOT EXISTS member_type TEXT,
ADD COLUMN IF NOT EXISTS cash_collected NUMERIC DEFAULT 0;