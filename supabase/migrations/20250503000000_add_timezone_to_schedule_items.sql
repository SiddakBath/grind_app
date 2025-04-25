-- Add timezone column to schedule_items table
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Update existing records to use UTC as default timezone
UPDATE schedule_items SET timezone = 'UTC' WHERE timezone IS NULL; 