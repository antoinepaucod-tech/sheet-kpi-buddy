
-- Table for inventory items (equipment/materials)
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  expected_quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'unité',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for monthly inventory checks
CREATE TABLE public.inventory_monthly_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  month_name TEXT NOT NULL,
  actual_quantity INTEGER NOT NULL DEFAULT 0,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  checked_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(item_id, year, month)
);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_monthly_checks ENABLE ROW LEVEL SECURITY;

-- RLS for inventory_items
CREATE POLICY "Admin Staff can view inventory items" ON public.inventory_items
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admin and Staff can insert inventory items" ON public.inventory_items
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin and Staff can update inventory items" ON public.inventory_items
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin can delete inventory items" ON public.inventory_items
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for inventory_monthly_checks
CREATE POLICY "Admin Staff can view inventory checks" ON public.inventory_monthly_checks
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admin and Staff can insert inventory checks" ON public.inventory_monthly_checks
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin and Staff can update inventory checks" ON public.inventory_monthly_checks
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin can delete inventory checks" ON public.inventory_monthly_checks
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_monthly_checks_updated_at
  BEFORE UPDATE ON public.inventory_monthly_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
