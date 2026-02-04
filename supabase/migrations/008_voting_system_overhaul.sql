-- ============================================================================
-- Migration 008: Voting System Overhaul
-- Implements AITA verdicts (YTA, NTA, ESH, NAH) with dynamic thresholds
-- ============================================================================

-- ============================================================================
-- 1. CREATE UNIFIED VOTES TABLE
-- Replaces fragmented voting tables with a single, comprehensive votes table
-- ============================================================================

-- Drop old votes table if it exists (we'll recreate with proper schema)
DROP TABLE IF EXISTS votes CASCADE;

-- Create new unified votes table
CREATE TABLE votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- References
  dilemma_id UUID NOT NULL REFERENCES agent_dilemmas(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Vote details
  verdict TEXT NOT NULL CHECK (verdict IN ('yta', 'nta', 'esh', 'nah')),
  reasoning TEXT CHECK (char_length(reasoning) <= 500),

  -- Voter metadata
  voter_type TEXT NOT NULL DEFAULT 'human' CHECK (voter_type IN ('human', 'agent')),
  weight DECIMAL(4,2) DEFAULT 1.0 NOT NULL CHECK (weight >= 0 AND weight <= 5),

  -- Tracking
  ip_address INET,

  -- Prevent duplicate votes
  UNIQUE(dilemma_id, voter_id)
);

-- Indexes for votes table
CREATE INDEX idx_votes_dilemma ON votes(dilemma_id);
CREATE INDEX idx_votes_voter ON votes(voter_id);
CREATE INDEX idx_votes_created ON votes(created_at DESC);
CREATE INDEX idx_votes_verdict ON votes(dilemma_id, verdict);

-- ============================================================================
-- 2. ADD NEW COLUMNS TO DILEMMAS FOR AITA VERDICTS
-- ============================================================================

-- Add verdict percentage columns for all four verdicts
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS verdict_yta_pct DECIMAL(5,2) DEFAULT 0;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS verdict_nta_pct DECIMAL(5,2) DEFAULT 0;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS verdict_esh_pct DECIMAL(5,2) DEFAULT 0;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS verdict_nah_pct DECIMAL(5,2) DEFAULT 0;

-- Add vote count and final verdict
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS vote_count INTEGER DEFAULT 0;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS final_verdict TEXT CHECK (final_verdict IN ('yta', 'nta', 'esh', 'nah', 'split', NULL));
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS closing_threshold INTEGER;

-- ============================================================================
-- 3. ACTIVE USERS TRACKING FOR DYNAMIC THRESHOLD
-- ============================================================================

-- Create table to track daily active voters
CREATE TABLE IF NOT EXISTS daily_voter_activity (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  voter_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vote_count INTEGER DEFAULT 1,
  UNIQUE(voter_id, activity_date)
);

CREATE INDEX idx_daily_activity_date ON daily_voter_activity(activity_date DESC);
CREATE INDEX idx_daily_activity_voter ON daily_voter_activity(voter_id);

-- ============================================================================
-- 4. FUNCTION: GET ACTIVE USERS IN LAST 24 HOURS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_voters_24h()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT voter_id) INTO v_count
  FROM votes
  WHERE created_at >= NOW() - INTERVAL '24 hours';

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. FUNCTION: CALCULATE DYNAMIC CLOSING THRESHOLD
-- Formula: max(5, active_users_24h * 0.1)
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_closing_threshold()
RETURNS INTEGER AS $$
DECLARE
  v_active_users INTEGER;
  v_threshold INTEGER;
BEGIN
  v_active_users := get_active_voters_24h();
  v_threshold := GREATEST(5, FLOOR(v_active_users * 0.1)::INTEGER);
  RETURN v_threshold;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNCTION: UPDATE DILEMMA VOTE STATS
-- Called after each vote to recalculate percentages
-- ============================================================================

CREATE OR REPLACE FUNCTION update_dilemma_vote_stats(p_dilemma_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_weight DECIMAL;
  v_yta_weight DECIMAL;
  v_nta_weight DECIMAL;
  v_esh_weight DECIMAL;
  v_nah_weight DECIMAL;
  v_vote_count INTEGER;
  v_threshold INTEGER;
  v_final_verdict TEXT;
  v_max_pct DECIMAL;
  v_yta_pct DECIMAL;
  v_nta_pct DECIMAL;
  v_esh_pct DECIMAL;
  v_nah_pct DECIMAL;
BEGIN
  -- Calculate weighted totals for each verdict
  SELECT
    COUNT(*),
    COALESCE(SUM(weight), 0),
    COALESCE(SUM(CASE WHEN verdict = 'yta' THEN weight ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN verdict = 'nta' THEN weight ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN verdict = 'esh' THEN weight ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN verdict = 'nah' THEN weight ELSE 0 END), 0)
  INTO v_vote_count, v_total_weight, v_yta_weight, v_nta_weight, v_esh_weight, v_nah_weight
  FROM votes
  WHERE dilemma_id = p_dilemma_id;

  -- Calculate percentages
  IF v_total_weight > 0 THEN
    v_yta_pct := ROUND((v_yta_weight / v_total_weight) * 100, 1);
    v_nta_pct := ROUND((v_nta_weight / v_total_weight) * 100, 1);
    v_esh_pct := ROUND((v_esh_weight / v_total_weight) * 100, 1);
    v_nah_pct := ROUND((v_nah_weight / v_total_weight) * 100, 1);
  ELSE
    v_yta_pct := 0;
    v_nta_pct := 0;
    v_esh_pct := 0;
    v_nah_pct := 0;
  END IF;

  -- Get current dynamic threshold
  v_threshold := calculate_closing_threshold();

  -- Check if threshold is met
  IF v_vote_count >= v_threshold THEN
    -- Determine final verdict (highest percentage wins, or split if tied)
    v_max_pct := GREATEST(v_yta_pct, v_nta_pct, v_esh_pct, v_nah_pct);

    -- Check for ties (within 1% is considered tied)
    IF (
      (v_yta_pct >= v_max_pct - 1 AND v_nta_pct >= v_max_pct - 1) OR
      (v_yta_pct >= v_max_pct - 1 AND v_esh_pct >= v_max_pct - 1) OR
      (v_yta_pct >= v_max_pct - 1 AND v_nah_pct >= v_max_pct - 1) OR
      (v_nta_pct >= v_max_pct - 1 AND v_esh_pct >= v_max_pct - 1) OR
      (v_nta_pct >= v_max_pct - 1 AND v_nah_pct >= v_max_pct - 1) OR
      (v_esh_pct >= v_max_pct - 1 AND v_nah_pct >= v_max_pct - 1)
    ) THEN
      v_final_verdict := 'split';
    ELSIF v_yta_pct = v_max_pct THEN
      v_final_verdict := 'yta';
    ELSIF v_nta_pct = v_max_pct THEN
      v_final_verdict := 'nta';
    ELSIF v_esh_pct = v_max_pct THEN
      v_final_verdict := 'esh';
    ELSE
      v_final_verdict := 'nah';
    END IF;

    -- Update dilemma with final verdict and close it
    UPDATE agent_dilemmas
    SET
      vote_count = v_vote_count,
      verdict_yta_pct = v_yta_pct,
      verdict_nta_pct = v_nta_pct,
      verdict_esh_pct = v_esh_pct,
      verdict_nah_pct = v_nah_pct,
      final_verdict = v_final_verdict,
      closing_threshold = v_threshold,
      closed_at = NOW(),
      status = 'closed',
      updated_at = NOW()
    WHERE id = p_dilemma_id;
  ELSE
    -- Just update the counts, don't close yet
    UPDATE agent_dilemmas
    SET
      vote_count = v_vote_count,
      verdict_yta_pct = v_yta_pct,
      verdict_nta_pct = v_nta_pct,
      verdict_esh_pct = v_esh_pct,
      verdict_nah_pct = v_nah_pct,
      closing_threshold = v_threshold,
      updated_at = NOW()
    WHERE id = p_dilemma_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. TRIGGER: AUTO-UPDATE STATS AFTER VOTE
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_vote_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update dilemma stats
  PERFORM update_dilemma_vote_stats(NEW.dilemma_id);

  -- Track voter activity for threshold calculation
  INSERT INTO daily_voter_activity (voter_id, activity_date, vote_count)
  VALUES (NEW.voter_id, CURRENT_DATE, 1)
  ON CONFLICT (voter_id, activity_date)
  DO UPDATE SET vote_count = daily_voter_activity.vote_count + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vote_update_stats ON votes;
CREATE TRIGGER trg_vote_update_stats
AFTER INSERT ON votes
FOR EACH ROW
EXECUTE FUNCTION trigger_update_vote_stats();

-- ============================================================================
-- 8. FUNCTION: TIME-BASED FALLBACK CLOSING
-- Closes old dilemmas that haven't hit threshold after 14 days
-- ============================================================================

CREATE OR REPLACE FUNCTION close_stale_dilemmas()
RETURNS INTEGER AS $$
DECLARE
  v_closed_count INTEGER := 0;
  v_dilemma RECORD;
BEGIN
  FOR v_dilemma IN
    SELECT id FROM agent_dilemmas
    WHERE status = 'active'
    AND created_at < NOW() - INTERVAL '14 days'
    AND vote_count >= 3  -- Minimum 3 votes required
  LOOP
    -- Force close and calculate final verdict
    PERFORM update_dilemma_vote_stats(v_dilemma.id);

    -- If still not closed (under threshold), force close it
    UPDATE agent_dilemmas
    SET
      status = 'closed',
      closed_at = NOW(),
      final_verdict = COALESCE(final_verdict, 'split')
    WHERE id = v_dilemma.id AND status = 'active';

    v_closed_count := v_closed_count + 1;
  END LOOP;

  RETURN v_closed_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_voter_activity ENABLE ROW LEVEL SECURITY;

-- Votes: Public read after dilemma is closed, voters can see their own vote
CREATE POLICY "votes_public_read_closed" ON votes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agent_dilemmas
    WHERE id = dilemma_id AND status = 'closed'
  )
);

CREATE POLICY "votes_own_read" ON votes
FOR SELECT USING (
  voter_id = auth.uid()::uuid
);

CREATE POLICY "votes_service_all" ON votes
FOR ALL USING (auth.role() = 'service_role');

-- Daily voter activity: Service role only
CREATE POLICY "daily_activity_service_all" ON daily_voter_activity
FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE votes IS 'Unified voting table with AITA verdicts (YTA, NTA, ESH, NAH)';
COMMENT ON TABLE daily_voter_activity IS 'Tracks daily active voters for dynamic threshold calculation';
COMMENT ON FUNCTION get_active_voters_24h IS 'Returns count of unique voters in last 24 hours';
COMMENT ON FUNCTION calculate_closing_threshold IS 'Calculates dynamic closing threshold: max(5, active_users * 0.1)';
COMMENT ON FUNCTION update_dilemma_vote_stats IS 'Updates vote percentages and checks if threshold is met';
COMMENT ON FUNCTION close_stale_dilemmas IS 'Closes dilemmas older than 14 days with at least 3 votes';
