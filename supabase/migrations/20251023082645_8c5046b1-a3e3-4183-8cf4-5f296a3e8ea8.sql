-- Add missing columns to weekly_kpis table
ALTER TABLE public.weekly_kpis
ADD COLUMN IF NOT EXISTS gym_floor_sqft numeric DEFAULT 0;

-- Add missing columns to monthly_kpis table
ALTER TABLE public.monthly_kpis
ADD COLUMN IF NOT EXISTS gym_floor_sqft numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS general_acrm numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS general_ltv numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pt_acrm numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pt_ltv numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cpl numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cpr numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cac numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS ro_ads numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pif_churn numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS general_churn numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pt_churn numeric DEFAULT 0;