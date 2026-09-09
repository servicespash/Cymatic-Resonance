import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Client Configuration Wrapper
 * 
 * Best Practices:
 * 1. Client-side: Always use VITE_SUPABASE_ANON_KEY (allows RLS-based access).
 * 2. Server-side (Edge Functions): Always use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
 *    NEVER hardcode, commit, or expose the SERVICE_ROLE_KEY in client-side code.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("[Supabase Critical] Missing required environment variables for client initialization.");
}

// Development/Production distinction can be handled via environment variable logic here
// if specific debugging or telemetry needs to be toggled per mode.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
});
