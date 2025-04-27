-- Drop existing habits table (if it exists)
DROP TABLE IF EXISTS habits;

-- Create new goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE NOT NULL,
  progress INTEGER DEFAULT 0,
  category TEXT DEFAULT 'Personal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for the goals table
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read only their own goals
CREATE POLICY "Users can view their own goals"
  ON goals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own goals
CREATE POLICY "Users can insert their own goals"
  ON goals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
  
-- Create policy for users to update only their own goals
CREATE POLICY "Users can update their own goals"
  ON goals
  FOR UPDATE
  USING (auth.uid() = user_id);
  
-- Create policy for users to delete only their own goals
CREATE POLICY "Users can delete their own goals"
  ON goals
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster querying
CREATE INDEX goals_user_id_idx ON goals (user_id);
CREATE INDEX goals_target_date_idx ON goals (target_date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER goals_updated_at
BEFORE UPDATE ON goals
FOR EACH ROW
EXECUTE FUNCTION update_modified_column(); 