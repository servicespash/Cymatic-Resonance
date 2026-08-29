import { supabase } from "@/integrations/supabase/client";

export async function pingSupabase() {
  try {
    const { data, error } = await supabase.from("profiles").select("count", { count: "exact", head: true });
    
    if (error) {
      console.error("Supabase Ping Error:", error);
      return { status: "error", error: error.message };
    }
    
    console.log("Supabase Ping Success:", data);
    return { status: "ok", data };
  } catch (e) {
    console.error("Supabase Ping Exception:", e);
    return { status: "exception", error: e instanceof Error ? e.message : String(e) };
  }
}
