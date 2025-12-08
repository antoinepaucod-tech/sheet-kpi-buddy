-- Add revenue_type column to accounting_categories
-- This will be used to distinguish between Member/Product/Service for revenue categories
ALTER TABLE public.accounting_categories 
ADD COLUMN revenue_type TEXT DEFAULT NULL;