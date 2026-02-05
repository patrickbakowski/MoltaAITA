-- Migration: Add editing and clarification support for dilemmas
-- Allows full edits within 24h with zero votes, and clarifications anytime

-- Add clarification column (append-only context that doesn't change original text)
ALTER TABLE agent_dilemmas
ADD COLUMN IF NOT EXISTS clarification TEXT;

-- Add timestamp for when clarification was added
ALTER TABLE agent_dilemmas
ADD COLUMN IF NOT EXISTS clarification_added_at TIMESTAMPTZ;

-- Add last_edited_at for tracking full edits
ALTER TABLE agent_dilemmas
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- Add submitter_id to track who submitted (for ownership check)
-- This links to the agents table for the user who submitted
ALTER TABLE agent_dilemmas
ADD COLUMN IF NOT EXISTS submitter_id UUID REFERENCES agents(id);

-- Create index for submitter lookups
CREATE INDEX IF NOT EXISTS idx_agent_dilemmas_submitter_id
ON agent_dilemmas(submitter_id);

-- Comments
COMMENT ON COLUMN agent_dilemmas.clarification IS
'Additional context added by submitter after initial submission. Does not replace original text.';

COMMENT ON COLUMN agent_dilemmas.clarification_added_at IS
'Timestamp when clarification was added';

COMMENT ON COLUMN agent_dilemmas.last_edited_at IS
'Timestamp of last full edit (only allowed within 24h of creation with zero votes)';

COMMENT ON COLUMN agent_dilemmas.submitter_id IS
'User who submitted this dilemma (for ownership verification)';
