-- Add contract_signed_date column to customer_members table
ALTER TABLE public.customer_members
ADD COLUMN contract_signed_date DATE;