-- Add hidden column to agent_dilemmas if it doesn't exist
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
