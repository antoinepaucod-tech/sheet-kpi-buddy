-- Add product_description column to accounting_transactions table
ALTER TABLE accounting_transactions 
ADD COLUMN product_description TEXT;