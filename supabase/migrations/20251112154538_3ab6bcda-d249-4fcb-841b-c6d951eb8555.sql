-- Add recurrence_end_date column to accounting_categories
ALTER TABLE accounting_categories 
ADD COLUMN recurrence_end_date date;