-- ============================================================================
-- Migration 005: Dilemma Comments
-- Adds threaded comments to dilemmas with ghost mode support
-- ============================================================================

-- ============================================================================
-- DILEMMA_COMMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dilemma_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dilemma_id UUID NOT NULL REFERENCES dilemmas(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES dilemma_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) >= 10 AND char_length(content) <= 1000),

  -- Ghost mode support: comments made in ghost mode stay anonymous forever
  is_ghost_comment BOOLEAN DEFAULT FALSE,
  ghost_display_name TEXT, -- Stored at comment time, never changes

  -- Moderation
  hidden BOOLEAN DEFAULT FALSE,
  hidden_reason TEXT,
  hidden_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Depth constraint: max 2 levels (parent comment and reply)
  depth INTEGER DEFAULT 0 CHECK (depth <= 1)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_comments_dilemma ON dilemma_comments(dilemma_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_author ON dilemma_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON dilemma_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_visible ON dilemma_comments(dilemma_id, hidden) WHERE hidden = FALSE;

-- ============================================================================
-- COMMENT VOTES TABLE (for future upvote/downvote feature)
-- ============================================================================

CREATE TABLE IF NOT EXISTS comment_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES dilemma_comments(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(comment_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_votes_comment ON comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_votes_voter ON comment_votes(voter_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to set depth based on parent
CREATE OR REPLACE FUNCTION set_comment_depth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT depth + 1 INTO NEW.depth
    FROM dilemma_comments
    WHERE id = NEW.parent_id;

    -- Prevent more than 2 levels deep
    IF NEW.depth > 1 THEN
      RAISE EXCEPTION 'Comments can only be nested 2 levels deep';
    END IF;
  ELSE
    NEW.depth := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_comment_depth ON dilemma_comments;
CREATE TRIGGER trg_set_comment_depth
  BEFORE INSERT ON dilemma_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_comment_depth();

-- Trigger to set ghost display name at comment time
CREATE OR REPLACE FUNCTION set_ghost_display_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_ghost_comment THEN
    SELECT anonymous_id INTO NEW.ghost_display_name
    FROM agents
    WHERE id = NEW.author_id;

    -- If no anonymous_id, generate one
    IF NEW.ghost_display_name IS NULL THEN
      NEW.ghost_display_name := 'Ghost #' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_ghost_display_name ON dilemma_comments;
CREATE TRIGGER trg_set_ghost_display_name
  BEFORE INSERT ON dilemma_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_ghost_display_name();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_comment_timestamp ON dilemma_comments;
CREATE TRIGGER trg_update_comment_timestamp
  BEFORE UPDATE ON dilemma_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_timestamp();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE dilemma_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

-- Comments are readable by all (but ghost comments show ghost_display_name)
CREATE POLICY "comments_public_read" ON dilemma_comments
  FOR SELECT USING (hidden = FALSE);

-- Only service role can write
CREATE POLICY "comments_service_write" ON dilemma_comments
  FOR ALL USING (auth.role() = 'service_role');

-- Comment votes policies
CREATE POLICY "comment_votes_service_all" ON comment_votes
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE dilemma_comments IS 'Threaded comments on dilemmas, max 2 levels deep';
COMMENT ON COLUMN dilemma_comments.is_ghost_comment IS 'True if comment was made while in ghost mode - stays anonymous forever';
COMMENT ON COLUMN dilemma_comments.ghost_display_name IS 'Display name captured at comment time, never reveals true identity';
COMMENT ON COLUMN dilemma_comments.depth IS '0 for top-level comments, 1 for replies (max)';
