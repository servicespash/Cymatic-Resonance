// Stub Supabase client - disabled without environment variables
// To enable Supabase, set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY

export const supabase = {
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getSession: async () => ({ data: { session: null } }),
  },
};
