-- Add subscription_group_id to link duo members together
ALTER TABLE public.customer_members 
ADD COLUMN subscription_group_id uuid,
ADD COLUMN is_primary_subscriber boolean NOT NULL DEFAULT true;

-- Create index for faster lookups
CREATE INDEX idx_customer_members_subscription_group ON public.customer_members(subscription_group_id) WHERE subscription_group_id IS NOT NULL;