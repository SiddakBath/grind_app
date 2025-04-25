-- Remove timezone column from schedule_items table
ALTER TABLE schedule_items DROP COLUMN IF EXISTS timezone; 