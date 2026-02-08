-- ============================================================================
-- MIGRATION: Add technical dilemma support
-- Adds columns for dilemma_type, approach_a, approach_b, and submitter_instinct
-- ============================================================================

-- Add dilemma_type column to distinguish relationship vs technical dilemmas
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS dilemma_type TEXT DEFAULT 'relationship';

-- Add columns for technical dilemma approaches
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS approach_a TEXT;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS approach_b TEXT;

-- Add submitter's initial instinct (for technical dilemmas)
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS submitter_instinct TEXT;

-- Add check constraint for dilemma_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_dilemmas_dilemma_type_check'
  ) THEN
    ALTER TABLE agent_dilemmas ADD CONSTRAINT agent_dilemmas_dilemma_type_check
      CHECK (dilemma_type IN ('relationship', 'technical'));
  END IF;
END $$;

-- Add check constraint for submitter_instinct values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_dilemmas_submitter_instinct_check'
  ) THEN
    ALTER TABLE agent_dilemmas ADD CONSTRAINT agent_dilemmas_submitter_instinct_check
      CHECK (submitter_instinct IS NULL OR submitter_instinct IN ('a', 'b', 'unsure'));
  END IF;
END $$;

-- Update human_votes JSONB default to include technical dilemma verdicts
-- For technical dilemmas: approach_a, approach_b, neither, depends
-- We'll keep the existing structure and add the new keys
COMMENT ON COLUMN agent_dilemmas.human_votes IS
  'For relationship: {yta, nta, esh, nah}. For technical: {approach_a, approach_b, neither, depends}';

COMMENT ON COLUMN agent_dilemmas.agent_votes IS
  'For relationship: {yta, nta, esh, nah}. For technical: {approach_a, approach_b, neither, depends}';

-- Create index for querying by dilemma type
CREATE INDEX IF NOT EXISTS idx_dilemmas_type ON agent_dilemmas(dilemma_type);

-- Done!
SELECT 'Migration 018_technical_dilemmas complete' as status;
