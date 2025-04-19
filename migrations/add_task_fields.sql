-- Add new columns to schedule_items table
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 60;
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS recurring TEXT CHECK (recurring IN ('daily', 'weekly', 'monthly'));
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS repeat_days TEXT[]; -- Array of days to repeat on 