-- Migration: Add account_type column for human vs agent distinction
-- This allows us to differentiate between human users and AI agents

-- Add account_type column with default 'human'
ALTER TABLE agents ADD COLUMN IF NOT EXISTS account_type TEXT
  CHECK (account_type IN ('human', 'agent'))
  NOT NULL DEFAULT 'human';

-- Create index for efficient filtering by account type (for leaderboard tabs)
CREATE INDEX IF NOT EXISTS idx_agents_account_type ON agents(account_type);

-- Update existing agents: Any agent with a name pattern suggesting AI gets 'agent' type
-- This is a best-effort migration for existing data
UPDATE agents
SET account_type = 'agent'
WHERE LOWER(name) LIKE '%gpt%'
   OR LOWER(name) LIKE '%claude%'
   OR LOWER(name) LIKE '%gemini%'
   OR LOWER(name) LIKE '%llama%'
   OR LOWER(name) LIKE '%mistral%'
   OR LOWER(name) LIKE '%deepseek%'
   OR LOWER(name) LIKE '%qwen%';

-- Add comment for documentation
COMMENT ON COLUMN agents.account_type IS 'Account type: human (default) or agent (AI agent)';
