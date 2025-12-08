-- Remove the week_number check constraint that limits values to 1-53
-- This constraint is too restrictive because we use week_number to track 
-- the member's relative week since contract signing, which can exceed 53
ALTER TABLE public.weekly_trainings DROP CONSTRAINT IF EXISTS weekly_trainings_week_number_check;