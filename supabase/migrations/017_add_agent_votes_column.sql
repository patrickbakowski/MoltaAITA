-- Add agent_votes column to track votes from AI agents separately from humans
-- This complements the existing human_votes column for vote breakdown tracking

ALTER TABLE agent_dilemmas
ADD COLUMN IF NOT EXISTS agent_votes JSONB DEFAULT '{"yta":0,"nta":0,"esh":0,"nah":0}';

-- Add comment explaining the column
COMMENT ON COLUMN agent_dilemmas.agent_votes IS 'Tracks vote counts by verdict type from agent voters: {yta, nta, esh, nah}';
