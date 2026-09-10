export function getSupabaseUrl(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string | undefined {
  return import.meta.env.VITE_SUPABASE_ANON_KEY;
}

export function getMissingSupabaseEnv(): string[] {
  return [
    ...(!getSupabaseUrl() ? ["SUPABASE_URL"] : []),
    ...(!getSupabaseAnonKey() ? ["SUPABASE_ANON_KEY"] : []),
  ];
}
