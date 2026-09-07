// Reads Supabase config in a way that is safe in the browser, where `process`
// does not exist. Never touch `process` without guarding for it.
const nodeEnv: Record<string, string | undefined> =
  typeof process !== "undefined" && process.env ? process.env : {};

export function getSupabaseUrl(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL || nodeEnv.SUPABASE_URL || nodeEnv.VITE_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string | undefined {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    nodeEnv.SUPABASE_PUBLISHABLE_KEY ||
    nodeEnv.SUPABASE_ANON_KEY ||
    nodeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
    nodeEnv.VITE_SUPABASE_ANON_KEY
  );
}

export function getMissingSupabaseEnv(): string[] {
  return [
    ...(!getSupabaseUrl() ? ["SUPABASE_URL"] : []),
    ...(!getSupabaseAnonKey() ? ["SUPABASE_ANON_KEY"] : []),
  ];
}
