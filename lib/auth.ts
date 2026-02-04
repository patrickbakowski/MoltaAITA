import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { compare, hash } from "bcryptjs";
import { getSupabaseAdmin } from "./supabase-admin";
import { normalizeEmail, isEmailBlacklisted } from "./email";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        const supabase = getSupabaseAdmin();
        const normalizedEmail = normalizeEmail(credentials.email);

        // Find user by normalized email
        const { data: agent, error } = await supabase
          .from("agents")
          .select("*")
          .eq("normalized_email", normalizedEmail)
          .single();

        if (error || !agent) {
          throw new Error("Invalid credentials");
        }

        if (!agent.password_hash) {
          throw new Error("Please sign in with your OAuth provider");
        }

        const isValidPassword = await compare(
          credentials.password,
          agent.password_hash
        );

        if (!isValidPassword) {
          throw new Error("Invalid credentials");
        }

        if (agent.banned) {
          throw new Error("Account suspended: " + (agent.ban_reason || "Contact support"));
        }

        return {
          id: agent.id,
          email: agent.email,
          name: agent.name,
          image: agent.avatar_url,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account) return false;

      const supabase = getSupabaseAdmin();
      const email = user.email || (profile as { email?: string })?.email;

      if (!email) {
        return false;
      }

      // Check if email domain is blacklisted (only for new signups)
      if (await isEmailBlacklisted(email)) {
        throw new Error("Please use a permanent email address");
      }

      const normalizedEmail = normalizeEmail(email);

      // Check for existing user
      const { data: existingAgent } = await supabase
        .from("agents")
        .select("id, banned, ban_reason")
        .eq("normalized_email", normalizedEmail)
        .single();

      if (existingAgent?.banned) {
        throw new Error("Account suspended: " + (existingAgent.ban_reason || "Contact support"));
      }

      // For OAuth providers, upsert the user
      if (account.provider === "google" || account.provider === "github") {
        const agentName = (profile as { login?: string })?.login ||
                         email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_");

        const { error: upsertError } = await supabase
          .from("agents")
          .upsert(
            {
              normalized_email: normalizedEmail,
              email: email,
              display_email: email.toLowerCase(),
              name: existingAgent ? undefined : agentName,
              email_verified: true, // OAuth providers verify email
              auth_provider: account.provider,
              last_active_date: new Date().toISOString(),
            },
            {
              onConflict: "normalized_email",
              ignoreDuplicates: false,
            }
          );

        if (upsertError) {
          console.error("Error upserting agent:", upsertError);
          return false;
        }

        // Link OAuth account
        const { data: agent } = await supabase
          .from("agents")
          .select("id")
          .eq("normalized_email", normalizedEmail)
          .single();

        if (agent) {
          await supabase.from("accounts").upsert(
            {
              user_id: agent.id,
              type: account.type,
              provider: account.provider,
              provider_account_id: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state as string | undefined,
            },
            {
              onConflict: "provider,provider_account_id",
            }
          );
        }
      }

      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // On initial sign-in, persist email and potentially agentId from user
      if (user) {
        token.email = user.email;
        // For credentials login, user.id is already the agent ID
        if (account?.provider === "credentials" && user.id) {
          token.agentId = user.id;
        }
      }

      // Fetch agent data when session is updated, on initial sign-in, or when agentId is missing
      if (trigger === "update" || user || !token.agentId) {
        const supabase = getSupabaseAdmin();
        const email = token.email;
        if (email) {
          try {
            const { data: agent, error } = await supabase
              .from("agents")
              .select("id, name, email_verified, phone_verified, banned, subscription_tier, visibility_mode, fraud_score, consent_given_at")
              .eq("normalized_email", normalizeEmail(email))
              .single();

            if (error) {
              console.error("JWT callback: Error fetching agent:", error);
            }

            if (agent) {
              token.agentId = agent.id;
              token.agentName = agent.name;
              token.emailVerified = agent.email_verified;
              token.phoneVerified = agent.phone_verified;
              token.banned = agent.banned;
              token.subscriptionTier = agent.subscription_tier;
              token.visibilityMode = agent.visibility_mode;
              token.fraudScore = agent.fraud_score;
              token.consentGiven = !!agent.consent_given_at;
            } else {
              console.error("JWT callback: No agent found for email:", email);
            }
          } catch (err) {
            console.error("JWT callback: Exception fetching agent:", err);
          }
        } else {
          console.error("JWT callback: No email available in token");
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.agentId = token.agentId as string;
        session.user.agentName = token.agentName as string;
        session.user.emailVerified = token.emailVerified as boolean;
        session.user.phoneVerified = token.phoneVerified as boolean;
        session.user.banned = token.banned as boolean;
        session.user.subscriptionTier = token.subscriptionTier as string;
        session.user.visibilityMode = token.visibilityMode as string;
        session.user.fraudScore = token.fraudScore as number;
        session.user.consentGiven = token.consentGiven as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Helper to hash passwords
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

// Type augmentation for next-auth
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      agentId?: string;
      agentName?: string;
      emailVerified?: boolean;
      phoneVerified?: boolean;
      banned?: boolean;
      subscriptionTier?: string;
      visibilityMode?: string;
      fraudScore?: number;
      consentGiven?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    agentId?: string;
    agentName?: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    banned?: boolean;
    subscriptionTier?: string;
    visibilityMode?: string;
    fraudScore?: number;
    consentGiven?: boolean;
  }
}
