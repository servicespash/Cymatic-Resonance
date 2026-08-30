import { supabase } from "@/integrations/supabase/client";
async function x() {
  const { data: allMsgs } = await supabase
    .from("messages")
    .select("id, channel_id, sender_id, body, created_at, profiles(full_name)")
    .eq("org_id", "123")
    .order("created_at", { ascending: false });
}
