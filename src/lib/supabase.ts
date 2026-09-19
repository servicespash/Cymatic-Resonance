import { createClient } from "@supabase/supabase-js";

// Retrieve environment variables with robust process.env and import.meta.env fallbacks
const supabaseUrl =
  (typeof process !== "undefined" && process.env ? process.env.SUPABASE_URL : "") ||
  import.meta.env.VITE_SUPABASE_URL ||
  "";
const supabaseAnonKey =
  (typeof process !== "undefined" && process.env ? process.env.SUPABASE_ANON_KEY : "") ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const getSupabase = () => supabase;

/**
 * Establishes the initial connection to the project's Supabase instance
 * by attempting to reach the designated Edge Function.
 */
export async function establishInitialConnection() {
  try {
    const { data, error } = await supabase.functions.invoke("Live-kit", {
      body: { name: "Functions" },
    });
    if (error) {
      console.warn("[Supabase Initial Connection] Invoke returned warning:", error.message);
    } else {
      console.log("[Supabase Initial Connection] Successful connection established:", data);
    }
    return { data, error };
  } catch (err) {
    console.warn("[Supabase Initial Connection] Edge Function invocation skipped or failed:", err);
    return { data: null, error: err };
  }
}
