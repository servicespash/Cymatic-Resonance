import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseAnonKey, getMissingSupabaseEnv } from "./env";

/**
 * Supabase Client Configuration Wrapper
 */

const dummyClient = new Proxy({} as any, {
  get: (target, prop) => {
    throw new Error(`[Supabase Error] Supabase is not configured (missing env vars: ${getMissingSupabaseEnv().join(", ")}). Cannot access: ${String(prop)}`);
  },
});

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(`[Supabase Critical] Missing environment variables: ${getMissingSupabaseEnv().join(", ")}. Using dummy client.`);
}

export const supabase = (!supabaseUrl || !supabaseAnonKey) 
  ? dummyClient 
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
          persistSession: true,
          autoRefreshToken: true,
      }
    });
