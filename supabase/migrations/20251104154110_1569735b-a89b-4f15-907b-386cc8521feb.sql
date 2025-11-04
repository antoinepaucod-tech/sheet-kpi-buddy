-- Add food expenses and credit repayment columns to monthly_kpis table
ALTER TABLE public.monthly_kpis
ADD COLUMN food_expenses numeric DEFAULT 0,
ADD COLUMN credit_repayment numeric DEFAULT 0;