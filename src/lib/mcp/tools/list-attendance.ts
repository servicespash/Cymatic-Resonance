import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_attendance",
  title: "List attendance",
  description:
    "List attendance records in the signed-in user's workspace. Optionally filter by ISO date range (inclusive).",
  inputSchema: {
    from: z.string().optional().describe("Start date YYYY-MM-DD (inclusive)."),
    to: z.string().optional().describe("End date YYYY-MM-DD (inclusive)."),
    only_me: z.boolean().optional().describe("If true, restrict to the current user's rows."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, only_me }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = supabase
      .from("attendance")
      .select("id, user_id, attendance_date, status, is_late, checked_in_at, checked_out_at, note")
      .order("checked_in_at", { ascending: false })
      .limit(200);
    if (from) q = q.gte("attendance_date", from);
    if (to) q = q.lte("attendance_date", to);
    if (only_me) q = q.eq("user_id", ctx.getUserId()!);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
