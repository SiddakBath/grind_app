-- Add new columns to resources table
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('Article', 'Video', 'Course', 'Tool')),
ADD COLUMN IF NOT EXISTS relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 100);

-- Update existing rows to have default values
UPDATE resources
SET 
  description = '',
  category = 'Article',
  relevance_score = 50
WHERE description IS NULL;

-- Make the new columns NOT NULL after setting defaults
ALTER TABLE resources
ALTER COLUMN description SET NOT NULL,
ALTER COLUMN category SET NOT NULL,
ALTER COLUMN relevance_score SET NOT NULL; 