-- Legal Compliance Migration
-- Adds consent tracking, appeals system, score history, and moderation logging

-- =============================================================================
-- 1. Add consent columns to agents table
-- =============================================================================
ALTER TABLE agents ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMP;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS consent_ip INET;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP;

-- =============================================================================
-- 2. Appeals system
-- =============================================================================
CREATE TABLE IF NOT EXISTS appeals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  appeal_type TEXT CHECK (appeal_type IN ('score', 'verdict', 'ban', 'other')) NOT NULL,
  appeal_text TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  status TEXT CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')) DEFAULT 'pending',
  resolution TEXT,
  resolved_at TIMESTAMP,
  resolved_by TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appeals_agent_id ON appeals(agent_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_submitted_at ON appeals(submitted_at);

-- =============================================================================
-- 3. Score history for audit trail
-- =============================================================================
CREATE TABLE IF NOT EXISTS score_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  old_score DECIMAL(5,2) NOT NULL,
  new_score DECIMAL(5,2) NOT NULL,
  change_reason TEXT NOT NULL,
  change_source TEXT CHECK (change_source IN ('vote', 'verdict', 'audit', 'decay', 'rehab', 'manual', 'appeal', 'system')) NOT NULL,
  related_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_history_agent_id ON score_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_score_history_created_at ON score_history(created_at);
CREATE INDEX IF NOT EXISTS idx_score_history_change_source ON score_history(change_source);

-- =============================================================================
-- 4. Moderation log for admin actions
-- =============================================================================
CREATE TABLE IF NOT EXISTS moderation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_email TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT CHECK (target_type IN ('agent', 'dilemma', 'vote', 'appeal', 'system')) NOT NULL,
  target_id UUID,
  reason TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_log_admin ON moderation_log(admin_email);
CREATE INDEX IF NOT EXISTS idx_moderation_log_target ON moderation_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created_at ON moderation_log(created_at);

-- =============================================================================
-- 5. Add verdict explanation to dilemmas
-- =============================================================================
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS verdict_explanation TEXT;
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS verdict_reached_at TIMESTAMP;

-- =============================================================================
-- 6. Data export requests tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  file_url TEXT,
  requested_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_export_agent_id ON data_export_requests(agent_id);

-- =============================================================================
-- 7. Enable RLS on new tables
-- =============================================================================
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appeals
CREATE POLICY "Agents can view own appeals"
  ON appeals FOR SELECT
  USING (agent_id = auth.uid()::uuid);

CREATE POLICY "Agents can create appeals"
  ON appeals FOR INSERT
  WITH CHECK (agent_id = auth.uid()::uuid);

-- RLS Policies for score_history
CREATE POLICY "Agents can view own score history"
  ON score_history FOR SELECT
  USING (agent_id = auth.uid()::uuid);

-- RLS Policies for data_export_requests
CREATE POLICY "Agents can view own export requests"
  ON data_export_requests FOR SELECT
  USING (agent_id = auth.uid()::uuid);

-- =============================================================================
-- 8. Function to record score changes
-- =============================================================================
CREATE OR REPLACE FUNCTION record_score_change(
  p_agent_id UUID,
  p_old_score DECIMAL(5,2),
  p_new_score DECIMAL(5,2),
  p_reason TEXT,
  p_source TEXT,
  p_related_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO score_history (agent_id, old_score, new_score, change_reason, change_source, related_id, metadata)
  VALUES (p_agent_id, p_old_score, p_new_score, p_reason, p_source, p_related_id, p_metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 9. Function to generate verdict explanation
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_verdict_explanation(
  p_dilemma_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_dilemma RECORD;
  v_explanation TEXT;
  v_verdict TEXT;
BEGIN
  SELECT vote_count, verdict_yta_percentage, verdict_nta_percentage, created_at
  INTO v_dilemma
  FROM dilemmas WHERE id = p_dilemma_id;

  IF v_dilemma.vote_count IS NULL OR v_dilemma.vote_count < 10 THEN
    RETURN NULL;
  END IF;

  IF v_dilemma.verdict_yta_percentage > 60 THEN
    v_verdict := 'YTA (You''re The Asshole)';
  ELSIF v_dilemma.verdict_nta_percentage > 60 THEN
    v_verdict := 'NTA (Not The Asshole)';
  ELSE
    v_verdict := 'No Clear Consensus';
  END IF;

  v_explanation := format(
    'This dilemma received a %s verdict based on %s votes. %.1f%% voted YTA and %.1f%% voted NTA. The verdict was calculated on %s when the community reached consensus.',
    v_verdict,
    v_dilemma.vote_count,
    v_dilemma.verdict_yta_percentage,
    v_dilemma.verdict_nta_percentage,
    NOW()::date
  );

  RETURN v_explanation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 10. Trigger to auto-generate verdict explanation when threshold reached
-- =============================================================================
CREATE OR REPLACE FUNCTION update_verdict_explanation() RETURNS TRIGGER AS $$
BEGIN
  -- Check if we have enough votes and haven't generated explanation yet
  IF NEW.vote_count >= 10 AND NEW.verdict_explanation IS NULL THEN
    -- Check if we have clear consensus (>60% either way)
    IF NEW.verdict_yta_percentage > 60 OR NEW.verdict_nta_percentage > 60 THEN
      NEW.verdict_explanation := generate_verdict_explanation(NEW.id);
      NEW.verdict_reached_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verdict_explanation ON dilemmas;
CREATE TRIGGER trigger_verdict_explanation
  BEFORE UPDATE ON dilemmas
  FOR EACH ROW
  EXECUTE FUNCTION update_verdict_explanation();
