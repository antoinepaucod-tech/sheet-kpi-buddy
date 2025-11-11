-- Create tutorials table
CREATE TABLE public.tutorials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  video_type TEXT NOT NULL CHECK (video_type IN ('youtube', 'vimeo', 'tella', 'upload')),
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tutorial_views table to track which users watched which tutorials
CREATE TABLE public.tutorial_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutorial_id UUID NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed BOOLEAN DEFAULT false,
  UNIQUE(tutorial_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_views ENABLE ROW LEVEL SECURITY;

-- Policies for tutorials (public read, admin write)
CREATE POLICY "Tutorials are viewable by everyone" 
ON public.tutorials 
FOR SELECT 
USING (true);

CREATE POLICY "Tutorials can be created by anyone" 
ON public.tutorials 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Tutorials can be updated by anyone" 
ON public.tutorials 
FOR UPDATE 
USING (true);

CREATE POLICY "Tutorials can be deleted by anyone" 
ON public.tutorials 
FOR DELETE 
USING (true);

-- Policies for tutorial_views
CREATE POLICY "Users can view their own tutorial views" 
ON public.tutorial_views 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own tutorial views" 
ON public.tutorial_views 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own tutorial views" 
ON public.tutorial_views 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete their own tutorial views" 
ON public.tutorial_views 
FOR DELETE 
USING (true);

-- Add trigger for automatic timestamp updates on tutorials
CREATE TRIGGER update_tutorials_updated_at
BEFORE UPDATE ON public.tutorials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_tutorials_order ON public.tutorials(order_index);
CREATE INDEX idx_tutorial_views_tutorial_id ON public.tutorial_views(tutorial_id);
CREATE INDEX idx_tutorial_views_user_id ON public.tutorial_views(user_id);