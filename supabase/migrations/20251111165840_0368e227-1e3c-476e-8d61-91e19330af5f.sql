-- Create instructors table
CREATE TABLE public.instructors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

-- Create policies for instructor access
CREATE POLICY "Anyone can view instructors" 
ON public.instructors 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert instructors" 
ON public.instructors 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update instructors" 
ON public.instructors 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete instructors" 
ON public.instructors 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_instructors_updated_at
BEFORE UPDATE ON public.instructors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();