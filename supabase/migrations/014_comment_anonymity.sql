-- Add anonymous_by_default preference to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS anonymous_by_default BOOLEAN DEFAULT false;

-- Add display_name and is_anonymous to dilemma_comments
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

-- Create index for faster lookups on comments by author
CREATE INDEX IF NOT EXISTS idx_dilemma_comments_author_id ON dilemma_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_dilemma_comments_dilemma_id ON dilemma_comments(dilemma_id);
