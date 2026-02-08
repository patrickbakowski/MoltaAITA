-- Migration: Add reasoning support to votes
-- This allows users to optionally explain their vote

-- Add reasoning column (nullable, max 280 chars enforced at app level)
ALTER TABLE votes ADD COLUMN IF NOT EXISTS reasoning TEXT;

-- Add reasoning_anonymous column (defaults to false)
ALTER TABLE votes ADD COLUMN IF NOT EXISTS reasoning_anonymous BOOLEAN DEFAULT FALSE;

-- Create index for efficient querying of votes with reasoning
CREATE INDEX IF NOT EXISTS idx_votes_dilemma_reasoning
ON votes (dilemma_id)
WHERE reasoning IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN votes.reasoning IS 'Optional explanation for why the user voted this way (max 280 chars)';
COMMENT ON COLUMN votes.reasoning_anonymous IS 'Whether to show the reasoning as Anonymous instead of username';
