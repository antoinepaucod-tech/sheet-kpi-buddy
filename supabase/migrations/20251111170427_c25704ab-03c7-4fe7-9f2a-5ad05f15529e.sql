-- Create course templates table for predefined courses
CREATE TABLE public.course_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create schedule templates table for default planning
CREATE TABLE public.schedule_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  course_name TEXT NOT NULL,
  instructor_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(day_of_week, time_slot)
);

-- Enable Row Level Security
ALTER TABLE public.course_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for course_templates
CREATE POLICY "Anyone can view course templates" 
ON public.course_templates 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert course templates" 
ON public.course_templates 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update course templates" 
ON public.course_templates 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete course templates" 
ON public.course_templates 
FOR DELETE 
USING (true);

-- Create policies for schedule_templates
CREATE POLICY "Anyone can view schedule templates" 
ON public.schedule_templates 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert schedule templates" 
ON public.schedule_templates 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update schedule templates" 
ON public.schedule_templates 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete schedule templates" 
ON public.schedule_templates 
FOR DELETE 
USING (true);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_course_templates_updated_at
BEFORE UPDATE ON public.course_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedule_templates_updated_at
BEFORE UPDATE ON public.schedule_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default course templates
INSERT INTO public.course_templates (name) VALUES
  ('Hyrox Engine'),
  ('Hyrox Power'),
  ('Hyrox Complete'),
  ('Hyrox Foundationnal'),
  ('Strengh'),
  ('IFRC Mobility'),
  ('Mobility'),
  ('Yoga');