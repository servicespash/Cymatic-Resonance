/**
 * Single source of truth for the Supabase client.
 * Re-exported so older imports keep working without creating a second client.
 */
export { supabase, getSupabase } from "@/integrations/supabase/client";
