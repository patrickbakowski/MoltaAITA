-- ============================================================================
-- Phase 2 Migration: Authentication, Payments, and Anti-Fraud
-- MoltAITA - The AI Reputation Layer
-- ============================================================================

-- ============================================================================
-- AGENTS TABLE EXTENSIONS
-- Add columns for auth, verification, fraud detection, and integrity gaming prevention
-- ============================================================================

-- Authentication & Verification
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS display_email TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS normalized_email TEXT UNIQUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS phone_hash TEXT UNIQUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS auth_provider TEXT CHECK (auth_provider IN ('credentials', 'google', 'github'));

-- Subscription extensions
ALTER TABLE agents ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'incognito', 'premium'));

-- Fraud detection
ALTER TABLE agents ADD COLUMN IF NOT EXISTS fraud_score DECIMAL(5,2) DEFAULT 0 CHECK (fraud_score >= 0);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS signup_captcha_score DECIMAL(3,2);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- Vote pattern detection
ALTER TABLE agents ADD COLUMN IF NOT EXISTS vote_pattern_hash TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_votes_cast INTEGER DEFAULT 0;

-- Integrity gaming prevention
ALTER TABLE agents ADD COLUMN IF NOT EXISTS daily_integrity_gained DECIMAL(5,2) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_integrity_reset_date DATE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_active_date TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS base_integrity_score DECIMAL(5,2) DEFAULT 50;

-- Master Audit tracking
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_audit_attempt_date TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS master_audit_passed BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS master_audit_passed_at TIMESTAMPTZ;

-- Rehabilitation tracking
ALTER TABLE agents ADD COLUMN IF NOT EXISTS rehab_started_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS rehab_completed_at TIMESTAMPTZ;

-- Ghost mode / visibility
ALTER TABLE agents ADD COLUMN IF NOT EXISTS visibility_mode TEXT DEFAULT 'public' CHECK (visibility_mode IN ('public', 'anonymous'));
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_reveal_date TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS can_hide_after TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS anonymous_id TEXT;

-- ============================================================================
-- HUMAN_VOTES TABLE EXTENSIONS
-- Add vote weighting and timing analysis
-- ============================================================================

ALTER TABLE human_votes ADD COLUMN IF NOT EXISTS vote_weight DECIMAL(3,2) DEFAULT 1.0;
ALTER TABLE human_votes ADD COLUMN IF NOT EXISTS time_on_dilemma INTEGER; -- seconds
ALTER TABLE human_votes ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;
ALTER TABLE human_votes ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id);
ALTER TABLE human_votes ADD COLUMN IF NOT EXISTS is_high_confidence BOOLEAN DEFAULT FALSE;
ALTER TABLE human_votes ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- AGENT_DILEMMAS TABLE EXTENSIONS
-- Add difficulty scoring and integrity rewards
-- ============================================================================

ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS difficulty_score DECIMAL(3,2);
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS integrity_reward DECIMAL(5,2);
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS controversy_score DECIMAL(3,2);
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS verdict_status TEXT CHECK (verdict_status IN ('pending', 'nta', 'yta', 'esh', 'nah', 'archived'));
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS eligible_for_audit_at TIMESTAMPTZ;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- ============================================================================
-- EMAIL VERIFICATION TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_tokens_agent ON email_verification_tokens(agent_id);
CREATE INDEX IF NOT EXISTS idx_email_tokens_expires ON email_verification_tokens(expires_at);

-- ============================================================================
-- MASTER AUDIT PURCHASES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS master_audit_purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  stripe_payment_id TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  amount INTEGER NOT NULL, -- cents
  currency TEXT DEFAULT 'cad',
  purchased_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_purchases_agent ON master_audit_purchases(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_purchases_stripe ON master_audit_purchases(stripe_payment_id);

-- ============================================================================
-- MASTER AUDIT SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS master_audit_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES master_audit_purchases(id),
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  questions JSONB NOT NULL, -- Array of question objects with dilemma_id, rephrased_text, original_verdict
  answers JSONB, -- Array of answer objects with question_index, vote, reasoning
  completed_at TIMESTAMPTZ,
  score DECIMAL(5,2), -- Percentage correct
  passed BOOLEAN,
  reasoning_hashes TEXT[], -- Array of hashed reasoning for plagiarism detection
  voided BOOLEAN DEFAULT FALSE,
  void_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_agent ON master_audit_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_expires ON master_audit_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_passed ON master_audit_sessions(passed) WHERE passed = TRUE;

-- ============================================================================
-- RATE LIMIT LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action_type TEXT NOT NULL, -- 'signup', 'dilemma', 'vote', 'jury', 'audit'
  identifier TEXT NOT NULL, -- IP address or agent_id
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup ON rate_limit_logs(action_type, identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_agent ON rate_limit_logs(agent_id, action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip ON rate_limit_logs(ip_address, action_type, created_at DESC);

-- ============================================================================
-- FRAUD EVENTS TABLE
-- Audit trail for fraud score changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS fraud_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'rapid_vote', 'vote_pattern_match', 'failed_captcha', 'duplicate_device', 'blacklisted_email', 'suspicious_timing'
  score_delta DECIMAL(5,2) NOT NULL,
  previous_score DECIMAL(5,2) NOT NULL,
  new_score DECIMAL(5,2) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb, -- Details about the event
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  review_result TEXT -- 'confirmed', 'false_positive', 'inconclusive'
);

CREATE INDEX IF NOT EXISTS idx_fraud_events_agent ON fraud_events(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_events_type ON fraud_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_events_unreviewed ON fraud_events(reviewed, created_at DESC) WHERE reviewed = FALSE;

-- ============================================================================
-- VOTE CORRELATION FLAGS TABLE
-- Flag pairs of agents with suspiciously similar voting patterns
-- ============================================================================

CREATE TABLE IF NOT EXISTS vote_correlation_flags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id_1 UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  agent_id_2 UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  correlation_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
  common_votes INTEGER NOT NULL,
  flagged_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  review_result TEXT, -- 'sockpuppet', 'coincidence', 'legitimate'
  action_taken TEXT, -- 'banned', 'warned', 'cleared'
  UNIQUE(agent_id_1, agent_id_2)
);

CREATE INDEX IF NOT EXISTS idx_vote_correlation_agents ON vote_correlation_flags(agent_id_1, agent_id_2);
CREATE INDEX IF NOT EXISTS idx_vote_correlation_unreviewed ON vote_correlation_flags(reviewed, flagged_at DESC) WHERE reviewed = FALSE;

-- ============================================================================
-- AUDIT PLAGIARISM FLAGS TABLE
-- Flag audit sessions with suspiciously similar reasoning
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_plagiarism_flags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id_1 UUID NOT NULL REFERENCES master_audit_sessions(id) ON DELETE CASCADE,
  session_id_2 UUID NOT NULL REFERENCES master_audit_sessions(id) ON DELETE CASCADE,
  similarity_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
  matching_questions INTEGER NOT NULL,
  flagged_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  review_result TEXT, -- 'plagiarism', 'coincidence', 'template'
  UNIQUE(session_id_1, session_id_2)
);

CREATE INDEX IF NOT EXISTS idx_audit_plagiarism_sessions ON audit_plagiarism_flags(session_id_1, session_id_2);
CREATE INDEX IF NOT EXISTS idx_audit_plagiarism_unreviewed ON audit_plagiarism_flags(reviewed, flagged_at DESC) WHERE reviewed = FALSE;

-- ============================================================================
-- REHAB VOTES TABLE
-- Track rehabilitation progress votes
-- ============================================================================

CREATE TABLE IF NOT EXISTS rehab_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  dilemma_id UUID NOT NULL REFERENCES agent_dilemmas(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('nta', 'yta', 'esh', 'nah')),
  reasoning TEXT NOT NULL CHECK (char_length(reasoning) >= 50), -- Minimum 50 characters
  voted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  aligned_with_consensus BOOLEAN,
  category TEXT, -- Copy from dilemma for diversity tracking
  UNIQUE(agent_id, dilemma_id)
);

CREATE INDEX IF NOT EXISTS idx_rehab_votes_agent ON rehab_votes(agent_id, voted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rehab_votes_category ON rehab_votes(agent_id, category);

-- ============================================================================
-- EMAIL DOMAIN BLACKLIST TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_domain_blacklist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  reason TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  added_by TEXT
);

-- Seed with common disposable email domains
INSERT INTO email_domain_blacklist (domain, reason) VALUES
  ('guerrillamail.com', 'Disposable email service'),
  ('guerrillamail.org', 'Disposable email service'),
  ('tempmail.com', 'Disposable email service'),
  ('temp-mail.org', 'Disposable email service'),
  ('10minutemail.com', 'Disposable email service'),
  ('10minutemail.net', 'Disposable email service'),
  ('mailinator.com', 'Disposable email service'),
  ('throwaway.email', 'Disposable email service'),
  ('fakeinbox.com', 'Disposable email service'),
  ('trashmail.com', 'Disposable email service'),
  ('yopmail.com', 'Disposable email service'),
  ('sharklasers.com', 'Disposable email service'),
  ('getnada.com', 'Disposable email service'),
  ('tempail.com', 'Disposable email service'),
  ('discard.email', 'Disposable email service'),
  ('maildrop.cc', 'Disposable email service'),
  ('mohmal.com', 'Disposable email service'),
  ('emailondeck.com', 'Disposable email service')
ON CONFLICT (domain) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_email_blacklist_domain ON email_domain_blacklist(domain);

-- ============================================================================
-- PHONE VERIFICATION ATTEMPTS TABLE
-- Track phone verification for rate limiting
-- ============================================================================

CREATE TABLE IF NOT EXISTS phone_verification_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  phone_number_hash TEXT NOT NULL, -- Hashed for privacy
  verification_sid TEXT, -- Twilio verification SID
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  verified_at TIMESTAMPTZ,
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_phone_verify_agent ON phone_verification_attempts(agent_id);
CREATE INDEX IF NOT EXISTS idx_phone_verify_hash ON phone_verification_attempts(phone_number_hash);

-- ============================================================================
-- VISIBILITY HISTORY TABLE
-- Track when agents switch between public and anonymous modes
-- ============================================================================

CREATE TABLE IF NOT EXISTS visibility_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  previous_mode TEXT NOT NULL,
  new_mode TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  anonymous_id_before TEXT,
  anonymous_id_after TEXT
);

CREATE INDEX IF NOT EXISTS idx_visibility_history_agent ON visibility_history(agent_id, changed_at DESC);

-- ============================================================================
-- DEVICE FINGERPRINTS TABLE
-- Track device fingerprints across accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_addresses INET[],
  user_agents TEXT[],
  UNIQUE(fingerprint, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_device_fp_fingerprint ON device_fingerprints(fingerprint);
CREATE INDEX IF NOT EXISTS idx_device_fp_agent ON device_fingerprints(agent_id);

-- ============================================================================
-- NEXTAUTH TABLES
-- Required for NextAuth.js integration
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(identifier, token)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);

-- ============================================================================
-- FUNCTIONS FOR PHASE 2
-- ============================================================================

-- Function to normalize email addresses
CREATE OR REPLACE FUNCTION normalize_email(email TEXT)
RETURNS TEXT AS $$
DECLARE
  local_part TEXT;
  domain TEXT;
  normalized TEXT;
BEGIN
  -- Lowercase the entire email
  email := LOWER(TRIM(email));

  -- Split into local and domain parts
  local_part := SPLIT_PART(email, '@', 1);
  domain := SPLIT_PART(email, '@', 2);

  -- For Gmail/Googlemail, remove dots and plus addressing
  IF domain IN ('gmail.com', 'googlemail.com') THEN
    -- Remove everything after + sign
    local_part := SPLIT_PART(local_part, '+', 1);
    -- Remove dots
    local_part := REPLACE(local_part, '.', '');
    -- Normalize googlemail to gmail
    domain := 'gmail.com';
  END IF;

  RETURN local_part || '@' || domain;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_action_type TEXT,
  p_identifier TEXT,
  p_limit INTEGER,
  p_window_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM rate_limit_logs
  WHERE action_type = p_action_type
    AND identifier = p_identifier
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  RETURN v_count < p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to log rate limit action
CREATE OR REPLACE FUNCTION log_rate_limit(
  p_action_type TEXT,
  p_identifier TEXT,
  p_agent_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO rate_limit_logs (action_type, identifier, agent_id, ip_address, metadata)
  VALUES (p_action_type, p_identifier, p_agent_id, p_ip_address, p_metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add fraud event and update score
CREATE OR REPLACE FUNCTION add_fraud_event(
  p_agent_id UUID,
  p_event_type TEXT,
  p_score_delta DECIMAL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS DECIMAL AS $$
DECLARE
  v_old_score DECIMAL;
  v_new_score DECIMAL;
BEGIN
  -- Get current fraud score
  SELECT fraud_score INTO v_old_score FROM agents WHERE id = p_agent_id;
  v_new_score := GREATEST(0, v_old_score + p_score_delta);

  -- Insert fraud event
  INSERT INTO fraud_events (agent_id, event_type, score_delta, previous_score, new_score, metadata)
  VALUES (p_agent_id, p_event_type, p_score_delta, v_old_score, v_new_score, p_metadata);

  -- Update agent's fraud score
  UPDATE agents
  SET fraud_score = v_new_score,
      banned = CASE WHEN v_new_score > 80 THEN TRUE ELSE banned END,
      ban_reason = CASE WHEN v_new_score > 80 AND NOT banned THEN 'Auto-banned: fraud score exceeded threshold' ELSE ban_reason END,
      banned_at = CASE WHEN v_new_score > 80 AND NOT banned THEN NOW() ELSE banned_at END
  WHERE id = p_agent_id;

  RETURN v_new_score;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate vote weight
CREATE OR REPLACE FUNCTION calculate_vote_weight(
  p_agent_id UUID,
  p_dilemma_controversy_score DECIMAL DEFAULT NULL
)
RETURNS DECIMAL AS $$
DECLARE
  v_weight DECIMAL := 1.0;
  v_account_age INTERVAL;
  v_total_votes INTEGER;
BEGIN
  -- Get agent info
  SELECT
    NOW() - created_at,
    total_votes_cast
  INTO v_account_age, v_total_votes
  FROM agents
  WHERE id = p_agent_id;

  -- New accounts (< 7 days or < 10 votes) get 0.5 weight
  IF v_account_age < INTERVAL '7 days' OR v_total_votes < 10 THEN
    v_weight := 0.5;
  END IF;

  -- Contested dilemmas (controversy < 0.3) get 1.5 weight
  IF p_dilemma_controversy_score IS NOT NULL AND p_dilemma_controversy_score < 0.3 THEN
    v_weight := v_weight * 1.5;
  END IF;

  RETURN v_weight;
END;
$$ LANGUAGE plpgsql;

-- Function to check if device fingerprint exists on another account
CREATE OR REPLACE FUNCTION check_duplicate_device(
  p_fingerprint TEXT,
  p_current_agent_id UUID
)
RETURNS TABLE(agent_id UUID, agent_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT a.id, a.name
  FROM device_fingerprints df
  JOIN agents a ON df.agent_id = a.id
  WHERE df.fingerprint = p_fingerprint
    AND df.agent_id != p_current_agent_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily integrity limits
CREATE OR REPLACE FUNCTION reset_daily_integrity()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE agents
  SET daily_integrity_gained = 0,
      last_integrity_reset_date = CURRENT_DATE
  WHERE last_integrity_reset_date IS NULL
     OR last_integrity_reset_date < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to apply integrity decay for inactive agents
CREATE OR REPLACE FUNCTION apply_integrity_decay()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE agents
  SET integrity_score = GREATEST(base_integrity_score, integrity_score - 0.5)
  WHERE last_active_date < NOW() - INTERVAL '7 days'
    AND integrity_score > base_integrity_score;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to auto-set normalized_email on insert/update
CREATE OR REPLACE FUNCTION trigger_normalize_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.normalized_email := normalize_email(NEW.email);
    NEW.display_email := LOWER(TRIM(NEW.email));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_email ON agents;
CREATE TRIGGER trg_normalize_email
  BEFORE INSERT OR UPDATE OF email ON agents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_normalize_email();

-- Trigger to update last_active_date
CREATE OR REPLACE FUNCTION trigger_update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agents SET last_active_date = NOW() WHERE id = NEW.agent_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vote_update_active ON human_votes;
CREATE TRIGGER trg_vote_update_active
  AFTER INSERT ON human_votes
  FOR EACH ROW
  WHEN (NEW.agent_id IS NOT NULL)
  EXECUTE FUNCTION trigger_update_last_active();

-- Trigger to generate anonymous_id for ghost mode
CREATE OR REPLACE FUNCTION trigger_generate_anonymous_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visibility_mode = 'anonymous' AND NEW.anonymous_id IS NULL THEN
    NEW.anonymous_id := 'Ghost #' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_anonymous_id ON agents;
CREATE TRIGGER trg_generate_anonymous_id
  BEFORE INSERT OR UPDATE OF visibility_mode ON agents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_anonymous_id();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_audit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_correlation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_plagiarism_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_domain_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visibility_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policies for email_verification_tokens
CREATE POLICY "email_tokens_service_all" ON email_verification_tokens FOR ALL USING (auth.role() = 'service_role');

-- Policies for master_audit_purchases
CREATE POLICY "audit_purchases_service_all" ON master_audit_purchases FOR ALL USING (auth.role() = 'service_role');

-- Policies for master_audit_sessions
CREATE POLICY "audit_sessions_service_all" ON master_audit_sessions FOR ALL USING (auth.role() = 'service_role');

-- Policies for rate_limit_logs
CREATE POLICY "rate_limit_service_all" ON rate_limit_logs FOR ALL USING (auth.role() = 'service_role');

-- Policies for fraud_events
CREATE POLICY "fraud_events_service_all" ON fraud_events FOR ALL USING (auth.role() = 'service_role');

-- Policies for vote_correlation_flags
CREATE POLICY "vote_correlation_service_all" ON vote_correlation_flags FOR ALL USING (auth.role() = 'service_role');

-- Policies for audit_plagiarism_flags
CREATE POLICY "audit_plagiarism_service_all" ON audit_plagiarism_flags FOR ALL USING (auth.role() = 'service_role');

-- Policies for rehab_votes
CREATE POLICY "rehab_votes_service_all" ON rehab_votes FOR ALL USING (auth.role() = 'service_role');

-- Policies for email_domain_blacklist (public read)
CREATE POLICY "email_blacklist_public_read" ON email_domain_blacklist FOR SELECT USING (true);
CREATE POLICY "email_blacklist_service_write" ON email_domain_blacklist FOR ALL USING (auth.role() = 'service_role');

-- Policies for phone_verification_attempts
CREATE POLICY "phone_verify_service_all" ON phone_verification_attempts FOR ALL USING (auth.role() = 'service_role');

-- Policies for visibility_history
CREATE POLICY "visibility_history_service_all" ON visibility_history FOR ALL USING (auth.role() = 'service_role');

-- Policies for device_fingerprints
CREATE POLICY "device_fp_service_all" ON device_fingerprints FOR ALL USING (auth.role() = 'service_role');

-- Policies for NextAuth tables
CREATE POLICY "accounts_service_all" ON accounts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "sessions_service_all" ON sessions FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE email_verification_tokens IS 'Tokens for email verification during signup';
COMMENT ON TABLE master_audit_purchases IS 'Stripe purchase records for Master Audit certification';
COMMENT ON TABLE master_audit_sessions IS 'Active and completed Master Audit test sessions';
COMMENT ON TABLE rate_limit_logs IS 'Action logs for rate limiting enforcement';
COMMENT ON TABLE fraud_events IS 'Audit trail of fraud score changes';
COMMENT ON TABLE vote_correlation_flags IS 'Flagged pairs of agents with similar voting patterns';
COMMENT ON TABLE audit_plagiarism_flags IS 'Flagged audit sessions with similar reasoning';
COMMENT ON TABLE rehab_votes IS 'Votes cast during rehabilitation program';
COMMENT ON TABLE email_domain_blacklist IS 'Disposable email domains blocked from signup';
COMMENT ON TABLE phone_verification_attempts IS 'Phone verification attempts via Twilio';
COMMENT ON TABLE visibility_history IS 'History of visibility mode changes';
COMMENT ON TABLE device_fingerprints IS 'Device fingerprints associated with accounts';

COMMENT ON FUNCTION normalize_email IS 'Normalizes email addresses for uniqueness checking';
COMMENT ON FUNCTION check_rate_limit IS 'Checks if action is within rate limits';
COMMENT ON FUNCTION add_fraud_event IS 'Records fraud event and updates agent fraud score';
COMMENT ON FUNCTION calculate_vote_weight IS 'Calculates vote weight based on account age and dilemma controversy';
