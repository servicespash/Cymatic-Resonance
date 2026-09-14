/**
 * Backend configuration is read exclusively from Vite environment variables.
 * Nothing here is hardcoded, so the same bundle works in preview and in
 * production simply by changing the environment.
 */

type ViteEnv = Record<string, string | undefined>;

const env = (import.meta.env ?? {}) as ViteEnv;

export function getSupabaseUrl(): string | undefined {
  return env.VITE_SUPABASE_URL || undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  // Accept either naming convention for the public (anon/publishable) key.
  return env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || undefined;
}

export function getMissingSupabaseEnv(): string[] {
  return [
    ...(!getSupabaseUrl() ? ["VITE_SUPABASE_URL"] : []),
    ...(!getSupabaseAnonKey() ? ["VITE_SUPABASE_ANON_KEY"] : []),
  ];
}
