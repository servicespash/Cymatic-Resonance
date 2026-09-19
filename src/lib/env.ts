/**
 * Backend configuration is read exclusively from Vite environment variables.
 * Nothing here is hardcoded, so the same bundle works in preview and in
 * production simply by changing the environment.
 */

// NOTE: these must be written as literal `import.meta.env.X` expressions so the
// bundler can inline them at build time (dynamic lookups are never replaced).
const BUILT_IN_URL = import.meta.env.VITE_SUPABASE_URL || "";
const BUILT_IN_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

const env = {
  VITE_SUPABASE_URL: BUILT_IN_URL || undefined,
  VITE_SUPABASE_ANON_KEY: BUILT_IN_KEY || undefined,
  VITE_SUPABASE_PUBLISHABLE_KEY: BUILT_IN_KEY || undefined,
} as Record<string, string | undefined>;

export function getSupabaseUrl(): string | undefined {
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
  return env.VITE_SUPABASE_URL || undefined;
}

export function getSupabaseAnonKey(): string | undefined {
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
  // Accept either naming convention for the public (anon/publishable) key.
  return env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || undefined;
}

export function getMissingSupabaseEnv(): string[] {
  return [
    ...(!getSupabaseUrl() ? ["VITE_SUPABASE_URL"] : []),
    ...(!getSupabaseAnonKey() ? ["VITE_SUPABASE_ANON_KEY"] : []),
  ];
}
