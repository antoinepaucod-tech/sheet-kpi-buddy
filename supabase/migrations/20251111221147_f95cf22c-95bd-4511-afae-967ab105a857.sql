-- Create accounting_transactions table for revenue and expense tracking
CREATE TABLE public.accounting_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL, -- 'revenue' or 'expense'
  category TEXT NOT NULL, -- e.g., 'Coach Pass Mensuel', 'Open Gym', 'Salaires', 'Loyer', etc.
  client_name TEXT,
  service_description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  amount_received NUMERIC DEFAULT 0,
  payment_method TEXT, -- 'Virement', 'Carte', 'Espèces', etc.
  invoice_number TEXT,
  notes TEXT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  month_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.accounting_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for full access
CREATE POLICY "Anyone can view accounting transactions" 
ON public.accounting_transactions 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert accounting transactions" 
ON public.accounting_transactions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update accounting transactions" 
ON public.accounting_transactions 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete accounting transactions" 
ON public.accounting_transactions 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_accounting_transactions_updated_at
BEFORE UPDATE ON public.accounting_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_accounting_transactions_year_month ON public.accounting_transactions(year, month);
CREATE INDEX idx_accounting_transactions_type ON public.accounting_transactions(transaction_type);
CREATE INDEX idx_accounting_transactions_date ON public.accounting_transactions(transaction_date);