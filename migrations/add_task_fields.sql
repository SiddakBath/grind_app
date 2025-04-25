-- Add new columns to schedule_items table
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS all_day BOOLEAN DEFAULT false;
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;

-- Drop legacy columns
ALTER TABLE schedule_items DROP COLUMN IF EXISTS time;
ALTER TABLE schedule_items DROP COLUMN IF EXISTS duration;
ALTER TABLE schedule_items DROP COLUMN IF EXISTS recurring;
ALTER TABLE schedule_items DROP COLUMN IF EXISTS repeat_days;
ALTER TABLE schedule_items DROP COLUMN IF EXISTS frequency;
ALTER TABLE schedule_items DROP COLUMN IF EXISTS interval; 