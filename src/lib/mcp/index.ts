import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listMembersTool from "./tools/list-members";
import listAttendanceTool from "./tools/list-attendance";
import checkInTool from "./tools/check-in";
import sendChannelMessageTool from "./tools/send-channel-message";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "cymatic-resonance-mcp",
  title: "Cymatic Resonance",
  version: "0.1.0",
  instructions:
    "Cymatic Resonance workspace tools. Sign in as a workspace member to check in, list attendance, browse members, and post messages. All actions run as the signed-in user under workspace RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listMembersTool, listAttendanceTool, checkInTool, sendChannelMessageTool],
});
