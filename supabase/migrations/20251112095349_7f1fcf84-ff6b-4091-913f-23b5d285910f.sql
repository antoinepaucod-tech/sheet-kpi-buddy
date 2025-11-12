-- Create accounting_categories table
CREATE TABLE public.accounting_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (type, name)
);

-- Enable Row Level Security
ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for full access (no authentication required)
CREATE POLICY "Anyone can view accounting categories" 
ON public.accounting_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert accounting categories" 
ON public.accounting_categories 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update accounting categories" 
ON public.accounting_categories 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete accounting categories" 
ON public.accounting_categories 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_accounting_categories_updated_at
BEFORE UPDATE ON public.accounting_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();