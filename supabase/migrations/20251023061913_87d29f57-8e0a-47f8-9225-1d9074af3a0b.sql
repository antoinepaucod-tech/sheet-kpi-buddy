-- Add send_hour and timezone columns to email_preferences table
ALTER TABLE public.email_preferences
ADD COLUMN IF NOT EXISTS send_hour INTEGER DEFAULT 9,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Add comment
COMMENT ON COLUMN public.email_preferences.send_hour IS 'Hour of the day to send reminder (0-23)';
COMMENT ON COLUMN public.email_preferences.timezone IS 'Timezone identifier (e.g., America/Montreal)';
