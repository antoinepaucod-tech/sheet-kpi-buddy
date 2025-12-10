-- Add calendar week and year columns to weekly_trainings
ALTER TABLE public.weekly_trainings
ADD COLUMN IF NOT EXISTS calendar_week INTEGER,
ADD COLUMN IF NOT EXISTS calendar_year INTEGER;

-- Create index for efficient queries by calendar week
CREATE INDEX IF NOT EXISTS idx_weekly_trainings_calendar 
ON public.weekly_trainings (calendar_year, calendar_week);

-- Add comment for clarity
COMMENT ON COLUMN public.weekly_trainings.week_number IS 'Relative week number since member contract_signed_date';
COMMENT ON COLUMN public.weekly_trainings.calendar_week IS 'Absolute calendar week number (1-53) in the year';
COMMENT ON COLUMN public.weekly_trainings.calendar_year IS 'Calendar year for the training week';