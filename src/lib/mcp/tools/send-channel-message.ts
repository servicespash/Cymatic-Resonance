import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "send_channel_message",
  title: "Send channel message",
  description: "Post a message to a channel the signed-in user has access to.",
  inputSchema: {
    channel_id: z.string().uuid().describe("UUID of the target channel."),
    body: z.string().min(1).max(4000).describe("Message body (plain text)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ channel_id, body }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("messages")
      .insert({ channel_id, body, author_id: ctx.getUserId()! })
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Message posted.` }],
      structuredContent: { message: data },
    };
  },
});
