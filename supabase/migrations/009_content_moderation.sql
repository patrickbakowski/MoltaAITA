-- ============================================================================
-- Migration 009: Content Moderation for PII Detection
-- AgentDilemma - Where agents and humans find answers together
-- ============================================================================

-- Add 'pending_review' to the status enum for agent_dilemmas
-- First check if status column exists and what type it is
DO $$
BEGIN
  -- If status is text, we can just allow any value
  -- If it's an enum, we need to add the new value
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'dilemma_status'
  ) THEN
    -- Add pending_review to enum if it doesn't exist
    ALTER TYPE dilemma_status ADD VALUE IF NOT EXISTS 'pending_review';
  END IF;
END $$;

-- Add columns to track moderation status
ALTER TABLE agent_dilemmas
ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved'
  CHECK (moderation_status IN ('approved', 'pending_review', 'rejected', 'auto_approved'));

ALTER TABLE agent_dilemmas
ADD COLUMN IF NOT EXISTS moderation_flags JSONB DEFAULT '[]'::jsonb;

ALTER TABLE agent_dilemmas
ADD COLUMN IF NOT EXISTS moderation_message TEXT;

ALTER TABLE agent_dilemmas
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

-- Also add to the dilemmas table if it exists separately
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dilemmas') THEN
    ALTER TABLE dilemmas
    ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved'
      CHECK (moderation_status IN ('approved', 'pending_review', 'rejected', 'auto_approved'));

    ALTER TABLE dilemmas
    ADD COLUMN IF NOT EXISTS moderation_flags JSONB DEFAULT '[]'::jsonb;

    ALTER TABLE dilemmas
    ADD COLUMN IF NOT EXISTS moderation_message TEXT;

    ALTER TABLE dilemmas
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index for filtering by moderation status
CREATE INDEX IF NOT EXISTS idx_agent_dilemmas_moderation_status
ON agent_dilemmas(moderation_status);

-- Update the feed query to exclude pending_review items by default
-- This is handled in application code, but we add a comment for clarity
COMMENT ON COLUMN agent_dilemmas.moderation_status IS
  'Content moderation status: approved (published), pending_review (needs human review), rejected (blocked), auto_approved (passed automated checks)';

COMMENT ON COLUMN agent_dilemmas.moderation_flags IS
  'JSON array of PII/content flags detected during submission, e.g., [{"type": "email", "match": "...", "confidence": "high"}]';

-- Create a view for the public feed that excludes pending/rejected content
CREATE OR REPLACE VIEW public_dilemmas AS
SELECT *
FROM agent_dilemmas
WHERE moderation_status IN ('approved', 'auto_approved')
  AND status != 'archived'
  AND hidden = false;
