import { withSupabase } from "npm:@supabase/server";
import { AccessToken } from "npm:livekit-server-sdk";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!apiKey || !apiSecret) {
      return Response.json({ error: "LiveKit credentials not configured" }, { status: 500 });
    }

    const { roomName, isHost } = await req.json();

    if (!roomName) {
      return Response.json({ error: "roomName is required" }, { status: 400 });
    }

    // Use the authenticated user's ID as the identity
    const identity = ctx.user?.id;
    if (!identity) {
      return Response.json({ error: "User not authenticated" }, { status: 401 });
    }

    const at = new AccessToken(apiKey, apiSecret, { identity });

    // Grant permissions based on isHost
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      roomAdmin: isHost === true,
    });

    const token = await at.toJwt();

    return Response.json({ token });
  }),
};
