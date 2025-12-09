-- Add sold_by column to track who sold/created the membership
ALTER TABLE public.customer_members 
ADD COLUMN sold_by text;