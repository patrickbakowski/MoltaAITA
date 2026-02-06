-- Add hidden_from_profile column to agent_dilemmas
-- This allows users to hide their submitted dilemmas from their public profile
-- while keeping them visible in the main feed and precedent library

ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS hidden_from_profile BOOLEAN DEFAULT false;

-- Create index for faster profile queries
CREATE INDEX IF NOT EXISTS idx_agent_dilemmas_submitter_profile
ON agent_dilemmas(submitter_id, hidden_from_profile)
WHERE hidden = false;
