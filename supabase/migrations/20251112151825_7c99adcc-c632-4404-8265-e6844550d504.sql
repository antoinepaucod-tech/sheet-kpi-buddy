-- Add is_recurring column to accounting_categories
ALTER TABLE accounting_categories 
ADD COLUMN is_recurring BOOLEAN DEFAULT false;

-- Add recurrence_day column for when in the month to generate
ALTER TABLE accounting_categories 
ADD COLUMN recurrence_day INTEGER DEFAULT 1;

-- Add default_amount column for recurring transactions
ALTER TABLE accounting_categories 
ADD COLUMN default_amount NUMERIC DEFAULT 0;