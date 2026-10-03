import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://umsgecaeozngdejwvcsu.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtc2dlY2Flb3puZ2Rland2Y3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTg4OTIsImV4cCI6MjA5NzYzNDg5Mn0.Zbp6Db69rSBI2egkPt6Puk0vTScVek7wF47HUT02-sQ";

// Retrieve environment variables with robust process.env and import.meta.env fallbacks
const supabaseUrl =
  (typeof process !== "undefined" && process.env ? process.env.SUPABASE_URL : "") ||
  import.meta.env.VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;
const supabaseAnonKey =
  (typeof process !== "undefined" && process.env ? process.env.SUPABASE_ANON_KEY : "") ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

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
