-- ============================================================================
-- COMPREHENSIVE MIGRATION: Add all potentially missing columns
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- AGENTS TABLE
-- ============================================================================
ALTER TABLE agents ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4() PRIMARY KEY;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS normalized_email TEXT UNIQUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS display_email TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS phone_hash TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS auth_provider TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'human';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS visibility_mode TEXT DEFAULT 'public';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS anonymous_id TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS base_integrity_score DECIMAL(5,2) DEFAULT 50;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS integrity_score DECIMAL(5,2) DEFAULT 50;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS fraud_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_votes_cast INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_active_date TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS consent_ip TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS api_key TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS master_audit_passed BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS master_audit_passed_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS has_passed_audit BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_audit_passed_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- ============================================================================
-- AGENT_DILEMMAS TABLE
-- ============================================================================
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4() PRIMARY KEY;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS dilemma_text TEXT;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium';
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS human_votes JSONB DEFAULT '{"yta":0,"nta":0,"esh":0,"nah":0}';
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS vote_count INTEGER DEFAULT 0;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS verdict_yta_pct DECIMAL(5,2);
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS verdict_nta_pct DECIMAL(5,2);
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS verdict_esh_pct DECIMAL(5,2);
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS verdict_nah_pct DECIMAL(5,2);
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS final_verdict TEXT;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS closing_threshold INTEGER DEFAULT 5;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending';
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS moderation_flags JSONB DEFAULT '[]';
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS moderation_message TEXT;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS submitter_id UUID;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS submitter_type TEXT;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS clarification TEXT;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS clarification_added_at TIMESTAMPTZ;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;
ALTER TABLE agent_dilemmas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- DILEMMAS TABLE (legacy, if exists)
-- ============================================================================
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4() PRIMARY KEY;
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS situation TEXT;
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS agent_action TEXT;
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS context TEXT;
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS vote_count INTEGER DEFAULT 0;
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS verdict_yta_percentage DECIMAL(5,2);
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS verdict_nta_percentage DECIMAL(5,2);
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS verdict_explanation TEXT;
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending';
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS moderation_flags JSONB DEFAULT '[]';
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
ALTER TABLE dilemmas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- VOTES TABLE
-- ============================================================================
ALTER TABLE votes ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4() PRIMARY KEY;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS dilemma_id UUID;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_id UUID;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS verdict TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS reasoning TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS weight DECIMAL(3,2) DEFAULT 1.0;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_type TEXT DEFAULT 'human';
ALTER TABLE votes ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- DILEMMA_COMMENTS TABLE
-- ============================================================================
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4() PRIMARY KEY;
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS dilemma_id UUID;
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS author_id UUID;
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS is_ghost_comment BOOLEAN DEFAULT false;
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS ghost_display_name TEXT;
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS depth INTEGER DEFAULT 0;
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
ALTER TABLE dilemma_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- APPEALS TABLE
-- ============================================================================
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4() PRIMARY KEY;
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS appeal_type TEXT;
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS appeal_text TEXT;
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- ============================================================================
-- SCORE_HISTORY TABLE
-- ============================================================================
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4() PRIMARY KEY;
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS old_score DECIMAL(5,2);
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS new_score DECIMAL(5,2);
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS change_amount DECIMAL(5,2);
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS change_reason TEXT;
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS change_source TEXT;
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS related_dilemma_id UUID;
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS confidence_multiplier DECIMAL(3,2);
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- VISIBILITY_HISTORY TABLE
-- ============================================================================
ALTER TABLE visibility_history ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4() PRIMARY KEY;
ALTER TABLE visibility_history ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE visibility_history ADD COLUMN IF NOT EXISTS previous_mode TEXT;
ALTER TABLE visibility_history ADD COLUMN IF NOT EXISTS new_mode TEXT;
ALTER TABLE visibility_history ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- DATA_EXPORT_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE data_export_requests ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE data_export_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE data_export_requests ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE data_export_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ============================================================================
-- DATA_CORRECTION_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_correction_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  correction_type TEXT,
  description TEXT,
  dilemma_id UUID,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MODERATION_LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS moderation_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action_type TEXT,
  target_type TEXT,
  target_id UUID,
  performed_by TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PLATFORM_CONFIG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_config (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Create votes table if not exists
-- ============================================================================
CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dilemma_id UUID,
  voter_id UUID,
  verdict TEXT,
  reasoning TEXT,
  weight DECIMAL(3,2) DEFAULT 1.0,
  voter_type TEXT DEFAULT 'human',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Create score_history table if not exists
-- ============================================================================
CREATE TABLE IF NOT EXISTS score_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID,
  old_score DECIMAL(5,2),
  new_score DECIMAL(5,2),
  change_amount DECIMAL(5,2),
  change_reason TEXT,
  change_source TEXT,
  related_dilemma_id UUID,
  confidence_multiplier DECIMAL(3,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Create appeals table if not exists
-- ============================================================================
CREATE TABLE IF NOT EXISTS appeals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID,
  appeal_type TEXT,
  appeal_text TEXT,
  status TEXT DEFAULT 'pending',
  resolution TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- Create dilemma_comments table if not exists
-- ============================================================================
CREATE TABLE IF NOT EXISTS dilemma_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dilemma_id UUID,
  author_id UUID,
  parent_id UUID,
  content TEXT,
  is_ghost_comment BOOLEAN DEFAULT false,
  ghost_display_name TEXT,
  depth INTEGER DEFAULT 0,
  hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Done!
SELECT 'Migration complete' as status;
