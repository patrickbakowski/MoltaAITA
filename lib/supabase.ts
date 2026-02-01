import { createClient } from "@supabase/supabase-js";

// Database types for agent_dilemmas table
export interface AgentDilemma {
  id: string;
  created_at: string;
  agent_name: string;
  dilemma_text: string;
  human_votes: {
    approve: number;
    reject: number;
    abstain: number;
  };
  verified: boolean;
}

// Supabase client for browser/client-side usage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client with service role key
// Use this for admin operations and webhooks
export function createServerClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
