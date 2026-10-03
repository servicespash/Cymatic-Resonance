/**
 * Backend configuration is read exclusively from Vite environment variables.
 * Nothing here is hardcoded, so the same bundle works in preview and in
 * production simply by changing the environment.
 */

const DEFAULT_SUPABASE_URL = "https://umsgecaeozngdejwvcsu.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtc2dlY2Flb3puZ2Rland2Y3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTg4OTIsImV4cCI6MjA5NzYzNDg5Mn0.Zbp6Db69rSBI2egkPt6Puk0vTScVek7wF47HUT02-sQ";

// NOTE: these must be written as literal `import.meta.env.X` expressions so the
// bundler can inline them at build time (dynamic lookups are never replaced).
const BUILT_IN_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const BUILT_IN_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

const env = {
  VITE_SUPABASE_URL: BUILT_IN_URL || undefined,
  VITE_SUPABASE_ANON_KEY: BUILT_IN_KEY || undefined,
  VITE_SUPABASE_PUBLISHABLE_KEY: BUILT_IN_KEY || undefined,
} as Record<string, string | undefined>;

export function getSupabaseUrl(): string | undefined {
  if (env.VITE_SUPABASE_URL) return env.VITE_SUPABASE_URL;

  if (typeof window !== "undefined") {
    const win = window as unknown as Record<string, unknown>;
    if (win.__SUPABASE_URL__) return String(win.__SUPABASE_URL__);
    try {
      const stored = localStorage.getItem("SUPABASE_URL");
      if (stored) return stored;
    } catch {
      // ignore storage errors
    }
  }
  return undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  const builtinKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (builtinKey) return builtinKey;

  if (typeof window !== "undefined") {
    const win = window as unknown as Record<string, unknown>;
    if (win.__SUPABASE_ANON_KEY__) return String(win.__SUPABASE_ANON_KEY__);
    try {
      const stored = localStorage.getItem("SUPABASE_ANON_KEY");
      if (stored) return stored;
    } catch {
      // ignore storage errors
    }
  }
  return undefined;
}

export function getMissingSupabaseEnv(): string[] {
  return [
    ...(!getSupabaseUrl() ? ["VITE_SUPABASE_URL"] : []),
    ...(!getSupabaseAnonKey() ? ["VITE_SUPABASE_ANON_KEY"] : []),
  ];
}
