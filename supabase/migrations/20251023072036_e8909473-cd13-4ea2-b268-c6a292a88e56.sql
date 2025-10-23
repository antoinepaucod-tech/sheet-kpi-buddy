-- Create monthly_kpis table to store aggregated monthly data
CREATE TABLE IF NOT EXISTS public.monthly_kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 0-11 (January = 0)
  month_name TEXT NOT NULL,
  
  -- Revenue fields
  general_eft_revenue NUMERIC DEFAULT 0,
  pt_revenue NUMERIC DEFAULT 0,
  retail_revenue NUMERIC DEFAULT 0,
  fast_cash_revenue NUMERIC DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  
  -- Member counts
  pif_members INTEGER DEFAULT 0,
  recurring_general_members INTEGER DEFAULT 0,
  pt_members INTEGER DEFAULT 0,
  total_active_members INTEGER DEFAULT 0,
  
  -- Member changes
  pif_exits INTEGER DEFAULT 0,
  general_exits INTEGER DEFAULT 0,
  pt_exits INTEGER DEFAULT 0,
  pauses INTEGER DEFAULT 0,
  
  -- Classes
  total_classes INTEGER DEFAULT 0,
  
  -- Sales funnel
  leads INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  scheduled INTEGER DEFAULT 0,
  show INTEGER DEFAULT 0,
  close INTEGER DEFAULT 0,
  cash_collected NUMERIC DEFAULT 0,
  
  -- Organic sales
  organic_leads INTEGER DEFAULT 0,
  organic_close INTEGER DEFAULT 0,
  organic_cash_collected NUMERIC DEFAULT 0,
  
  -- Trial conversion
  in_trial INTEGER DEFAULT 0,
  trial_ending INTEGER DEFAULT 0,
  converted INTEGER DEFAULT 0,
  
  -- Expenses
  ad_spend NUMERIC DEFAULT 0,
  rent NUMERIC DEFAULT 0,
  repairs_maintenance NUMERIC DEFAULT 0,
  computer_software NUMERIC DEFAULT 0,
  internet_telephone NUMERIC DEFAULT 0,
  stationary NUMERIC DEFAULT 0,
  utilities NUMERIC DEFAULT 0,
  advertising_promotion NUMERIC DEFAULT 0,
  legal_professional NUMERIC DEFAULT 0,
  charitable_donations NUMERIC DEFAULT 0,
  subscriptions NUMERIC DEFAULT 0,
  bank_finance_charges NUMERIC DEFAULT 0,
  insurance NUMERIC DEFAULT 0,
  total_expenses NUMERIC DEFAULT 0,
  
  -- Calculated fields
  profit NUMERIC DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(year, month)
);

-- Enable RLS
ALTER TABLE public.monthly_kpis ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view monthly KPIs"
ON public.monthly_kpis FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert monthly KPIs"
ON public.monthly_kpis FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update monthly KPIs"
ON public.monthly_kpis FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete monthly KPIs"
ON public.monthly_kpis FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_monthly_kpis_updated_at
BEFORE UPDATE ON public.monthly_kpis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();