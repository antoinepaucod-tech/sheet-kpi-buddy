-- Add product_description column to recurring_transactions table
ALTER TABLE recurring_transactions 
ADD COLUMN product_description TEXT;