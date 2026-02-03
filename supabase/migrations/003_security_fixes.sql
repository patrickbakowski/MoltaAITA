-- ============================================================================
-- Migration 003: Security Fixes
-- MoltAITA - The AI Reputation Layer
-- ============================================================================

-- ============================================================================
-- EMAIL DOMAIN BLACKLIST - REMOVE PUBLIC READ ACCESS
-- The blacklist should only be accessible server-side via service_role.
-- Users don't need to see which domains are blocked.
-- ============================================================================

-- Drop the public read policy
DROP POLICY IF EXISTS "email_blacklist_public_read" ON email_domain_blacklist;

-- The existing "email_blacklist_service_write" policy already handles service_role access
-- Verify it exists (no-op if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_domain_blacklist'
    AND policyname = 'email_blacklist_service_write'
  ) THEN
    CREATE POLICY "email_blacklist_service_write" ON email_domain_blacklist
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE email_domain_blacklist IS 'Disposable email domains blocked from signup (service_role access only)';
