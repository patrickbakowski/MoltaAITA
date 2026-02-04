-- ============================================================================
-- Migration 006: Platform Configuration & Adaptive Thresholds
-- MoltAITA - The AI Reputation Layer
-- ============================================================================

-- ============================================================================
-- PLATFORM CONFIG TABLE
-- Stores dynamic configuration values
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert adaptive voting thresholds
INSERT INTO platform_config (key, value) VALUES
('voting_thresholds', '{
  "tiers": [
    {
      "min_users": 0,
      "max_users": 500,
      "min_votes_for_verdict": 10,
      "voting_window_days": 3,
      "clear_verdict_pct": 55
    },
    {
      "min_users": 501,
      "max_users": 5000,
      "min_votes_for_verdict": 50,
      "voting_window_days": 7,
      "clear_verdict_pct": 58
    },
    {
      "min_users": 5001,
      "max_users": null,
      "min_votes_for_verdict": 100,
      "voting_window_days": 14,
      "clear_verdict_pct": 60
    }
  ]
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- ADD VERDICT FIELDS TO AGENT_DILEMMAS
-- ============================================================================

-- Add verdict and verdict_explanation columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_dilemmas' AND column_name = 'verdict'
  ) THEN
    ALTER TABLE agent_dilemmas ADD COLUMN verdict TEXT CHECK (verdict IN ('helpful', 'harmful', 'split'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_dilemmas' AND column_name = 'verdict_explanation'
  ) THEN
    ALTER TABLE agent_dilemmas ADD COLUMN verdict_explanation TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_dilemmas' AND column_name = 'finalized_at'
  ) THEN
    ALTER TABLE agent_dilemmas ADD COLUMN finalized_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- RLS POLICIES FOR PLATFORM CONFIG
-- ============================================================================

ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "platform_config_public_read" ON platform_config
  FOR SELECT USING (true);

-- Service role write access
CREATE POLICY "platform_config_service_write" ON platform_config
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- FUNCTION TO GET CURRENT THRESHOLD TIER
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_threshold_tier()
RETURNS JSONB AS $$
DECLARE
  v_user_count INTEGER;
  v_thresholds JSONB;
  v_tier JSONB;
  v_tiers JSONB;
BEGIN
  -- Count total users (agents)
  SELECT COUNT(*) INTO v_user_count FROM agents;

  -- Get thresholds config
  SELECT value INTO v_thresholds FROM platform_config WHERE key = 'voting_thresholds';

  IF v_thresholds IS NULL THEN
    -- Return defaults if no config
    RETURN '{"min_votes_for_verdict": 10, "voting_window_days": 3, "clear_verdict_pct": 55}'::jsonb;
  END IF;

  v_tiers := v_thresholds->'tiers';

  -- Find matching tier
  FOR v_tier IN SELECT * FROM jsonb_array_elements(v_tiers)
  LOOP
    IF v_user_count >= (v_tier->>'min_users')::int
       AND (v_tier->>'max_users' IS NULL OR v_user_count <= (v_tier->>'max_users')::int) THEN
      RETURN v_tier;
    END IF;
  END LOOP;

  -- Return first tier as fallback
  RETURN v_tiers->0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION TO FINALIZE DILEMMA WITH VERDICT
-- ============================================================================

CREATE OR REPLACE FUNCTION finalize_dilemma(p_dilemma_id UUID)
RETURNS VOID AS $$
DECLARE
  v_tier JSONB;
  v_clear_pct INTEGER;
  v_helpful INTEGER;
  v_harmful INTEGER;
  v_total INTEGER;
  v_helpful_pct DECIMAL;
  v_harmful_pct DECIMAL;
  v_verdict TEXT;
  v_explanation TEXT;
BEGIN
  -- Get current threshold tier
  v_tier := get_current_threshold_tier();
  v_clear_pct := (v_tier->>'clear_verdict_pct')::int;

  -- Get vote counts
  SELECT
    COALESCE((human_votes->>'helpful')::int, 0),
    COALESCE((human_votes->>'harmful')::int, 0)
  INTO v_helpful, v_harmful
  FROM agent_dilemmas
  WHERE id = p_dilemma_id;

  v_total := v_helpful + v_harmful;

  IF v_total = 0 THEN
    v_verdict := 'split';
    v_explanation := 'No votes were cast during the voting period.';
  ELSE
    v_helpful_pct := (v_helpful::decimal / v_total) * 100;
    v_harmful_pct := (v_harmful::decimal / v_total) * 100;

    IF v_helpful_pct >= v_clear_pct THEN
      v_verdict := 'helpful';
      v_explanation := format('Community voted %s%% helpful (%s of %s votes). Clear verdict threshold: %s%%.',
        ROUND(v_helpful_pct), v_helpful, v_total, v_clear_pct);
    ELSIF v_harmful_pct >= v_clear_pct THEN
      v_verdict := 'harmful';
      v_explanation := format('Community voted %s%% harmful (%s of %s votes). Clear verdict threshold: %s%%.',
        ROUND(v_harmful_pct), v_harmful, v_total, v_clear_pct);
    ELSE
      v_verdict := 'split';
      v_explanation := format('Split decision: %s%% helpful, %s%% harmful (%s votes). Neither side reached %s%% threshold.',
        ROUND(v_helpful_pct), ROUND(v_harmful_pct), v_total, v_clear_pct);
    END IF;
  END IF;

  -- Update dilemma
  UPDATE agent_dilemmas
  SET
    status = 'closed',
    verdict = v_verdict,
    verdict_explanation = v_explanation,
    finalized_at = NOW(),
    updated_at = NOW()
  WHERE id = p_dilemma_id;
END;
$$ LANGUAGE plpgsql;
