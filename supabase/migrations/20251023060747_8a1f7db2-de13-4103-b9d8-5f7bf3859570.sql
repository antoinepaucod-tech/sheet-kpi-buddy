-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create weekly KPI data table
CREATE TABLE public.weekly_kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Revenue
  total_revenue DECIMAL(10,2) DEFAULT 0,
  general_eft_revenue DECIMAL(10,2) DEFAULT 0,
  pt_revenue DECIMAL(10,2) DEFAULT 0,
  retail_revenue DECIMAL(10,2) DEFAULT 0,
  fast_cash_revenue DECIMAL(10,2) DEFAULT 0,
  
  -- Members
  pif_members INTEGER DEFAULT 0,
  pif_exits INTEGER DEFAULT 0,
  pauses INTEGER DEFAULT 0,
  recurring_general_members INTEGER DEFAULT 0,
  general_exits INTEGER DEFAULT 0,
  pt_members INTEGER DEFAULT 0,
  pt_exits INTEGER DEFAULT 0,
  
  -- Classes
  total_classes INTEGER DEFAULT 0,
  
  -- Leads & Sales
  leads INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  scheduled INTEGER DEFAULT 0,
  show INTEGER DEFAULT 0,
  close INTEGER DEFAULT 0,
  cash_collected DECIMAL(10,2) DEFAULT 0,
  
  -- Organic
  organic_leads INTEGER DEFAULT 0,
  organic_close INTEGER DEFAULT 0,
  organic_cash_collected DECIMAL(10,2) DEFAULT 0,
  
  -- Trials
  in_trial INTEGER DEFAULT 0,
  trial_ending INTEGER DEFAULT 0,
  converted INTEGER DEFAULT 0,
  
  -- Expenses
  ad_spend DECIMAL(10,2) DEFAULT 0,
  rent DECIMAL(10,2) DEFAULT 0,
  repairs_maintenance DECIMAL(10,2) DEFAULT 0,
  computer_software DECIMAL(10,2) DEFAULT 0,
  internet_telephone DECIMAL(10,2) DEFAULT 0,
  stationary DECIMAL(10,2) DEFAULT 0,
  utilities DECIMAL(10,2) DEFAULT 0,
  advertising_promotion DECIMAL(10,2) DEFAULT 0,
  legal_professional DECIMAL(10,2) DEFAULT 0,
  charitable_donations DECIMAL(10,2) DEFAULT 0,
  subscriptions DECIMAL(10,2) DEFAULT 0,
  bank_finance_charges DECIMAL(10,2) DEFAULT 0,
  insurance DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(year, week_number)
);

-- Enable RLS
ALTER TABLE public.weekly_kpis ENABLE ROW LEVEL SECURITY;

-- Create policies - data is public for this app
CREATE POLICY "Anyone can view weekly KPIs"
  ON public.weekly_kpis
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert weekly KPIs"
  ON public.weekly_kpis
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update weekly KPIs"
  ON public.weekly_kpis
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete weekly KPIs"
  ON public.weekly_kpis
  FOR DELETE
  USING (true);

-- Create email preferences table
CREATE TABLE public.email_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for email preferences
CREATE POLICY "Anyone can view email preferences"
  ON public.email_preferences
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can manage email preferences"
  ON public.email_preferences
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_weekly_kpis_updated_at
  BEFORE UPDATE ON public.weekly_kpis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Schedule the weekly reminder email (every Monday at 9 AM UTC)
SELECT cron.schedule(
  'send-weekly-kpi-reminder',
  '0 9 * * 1',
  $$
  SELECT
    net.http_post(
      url:='https://rujpspjvyndjtkvjbbhq.supabase.co/functions/v1/send-weekly-reminder',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anBzcGp2eW5kanRrdmpiYmhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNzg3MTEsImV4cCI6MjA3Njc1NDcxMX0.wCA7jjQVFUaIMUsao9ULWZSBXN99XFXZFSPtKWT8c9U"}'::jsonb,
      body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
