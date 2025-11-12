-- Add is_indefinite_recurrence column to accounting_categories
ALTER TABLE accounting_categories 
ADD COLUMN is_indefinite_recurrence BOOLEAN DEFAULT false;