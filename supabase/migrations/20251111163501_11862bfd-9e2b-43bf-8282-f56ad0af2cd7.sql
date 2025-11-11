-- Create table for course KPIs
CREATE TABLE public.course_kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Course details
  course_name TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  instructor TEXT,
  
  -- Period
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  month_name TEXT NOT NULL,
  
  -- Weekly attendance (up to 5 weeks per month)
  week1_attendance INTEGER DEFAULT 0,
  week2_attendance INTEGER DEFAULT 0,
  week3_attendance INTEGER DEFAULT 0,
  week4_attendance INTEGER DEFAULT 0,
  week5_attendance INTEGER DEFAULT 0,
  
  -- Financial
  monthly_expenses NUMERIC DEFAULT 0,
  attendance_rate NUMERIC DEFAULT 0,
  
  -- Max capacity for calculating percentage
  max_capacity INTEGER DEFAULT 10
);

-- Enable Row Level Security
ALTER TABLE public.course_kpis ENABLE ROW LEVEL SECURITY;

-- Create policies for course KPIs
CREATE POLICY "Anyone can view course KPIs" 
ON public.course_kpis 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert course KPIs" 
ON public.course_kpis 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update course KPIs" 
ON public.course_kpis 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete course KPIs" 
ON public.course_kpis 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_course_kpis_updated_at
BEFORE UPDATE ON public.course_kpis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();