-- Add validation status field to accounting_transactions
ALTER TABLE public.accounting_transactions 
ADD COLUMN IF NOT EXISTS is_validated BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT false;