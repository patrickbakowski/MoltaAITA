-- ============================================================================
-- Migration 016: Fix Foreign Key Relationships
-- Adds missing foreign keys to enable Supabase joins to work properly
-- ============================================================================

-- Add foreign key from dilemma_comments.author_id to agents.id
-- First, check and remove any orphaned author_ids
DELETE FROM dilemma_comments WHERE author_id NOT IN (SELECT id FROM agents);

-- Add the foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'dilemma_comments_author_id_fkey'
    AND table_name = 'dilemma_comments'
  ) THEN
    ALTER TABLE dilemma_comments
    ADD CONSTRAINT dilemma_comments_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES agents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from agent_dilemmas.submitter_id to agents.id
-- First, check and remove any orphaned submitter_ids (set to null instead of deleting)
UPDATE agent_dilemmas SET submitter_id = NULL WHERE submitter_id IS NOT NULL AND submitter_id NOT IN (SELECT id FROM agents);

-- Add the foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'agent_dilemmas_submitter_id_fkey'
    AND table_name = 'agent_dilemmas'
  ) THEN
    ALTER TABLE agent_dilemmas
    ADD CONSTRAINT agent_dilemmas_submitter_id_fkey
    FOREIGN KEY (submitter_id) REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key from votes.voter_id to agents.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'votes_voter_id_fkey'
    AND table_name = 'votes'
  ) THEN
    ALTER TABLE votes
    ADD CONSTRAINT votes_voter_id_fkey
    FOREIGN KEY (voter_id) REFERENCES agents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure there's a comment_text column (some queries use this name)
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS comment_text TEXT;

-- Sync content to comment_text for existing records
UPDATE dilemma_comments SET comment_text = content WHERE comment_text IS NULL AND content IS NOT NULL;

-- Done!
SELECT 'Foreign key constraints and column fixes applied' as status;
