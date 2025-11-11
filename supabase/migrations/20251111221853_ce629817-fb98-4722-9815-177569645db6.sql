-- Create recurring_transactions table for recurring revenue/expense templates
CREATE TABLE public.recurring_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_type TEXT NOT NULL, -- 'revenue' or 'expense'
  category TEXT NOT NULL,
  client_name TEXT,
  service_description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  amount_received NUMERIC DEFAULT 0,
  payment_method TEXT,
  invoice_number_prefix TEXT, -- e.g., '#' for auto-numbering
  notes TEXT,
  recurrence_day INTEGER DEFAULT 1, -- day of month (1-31)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for full access
CREATE POLICY "Anyone can view recurring transactions" 
ON public.recurring_transactions 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert recurring transactions" 
ON public.recurring_transactions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update recurring transactions" 
ON public.recurring_transactions 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete recurring transactions" 
ON public.recurring_transactions 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_recurring_transactions_updated_at
BEFORE UPDATE ON public.recurring_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_recurring_transactions_active ON public.recurring_transactions(is_active) WHERE is_active = true;