-- Add exit_date column to customer_members table
ALTER TABLE customer_members
ADD COLUMN exit_date DATE DEFAULT NULL;