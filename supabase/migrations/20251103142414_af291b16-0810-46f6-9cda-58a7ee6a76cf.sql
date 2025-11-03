-- Add salaries column to monthly_kpis table
ALTER TABLE public.monthly_kpis
ADD COLUMN salaries numeric DEFAULT 0;