import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.0.0";

const apiKey = Deno.env.get("LIVEKIT_API_KEY");
const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");

serve(async (req) => {
  if (!apiKey || !apiSecret) {
    return new Response(JSON.stringify({ error: "LiveKit credentials not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { room, identity } = await req.json();

  if (!room || !identity) {
    return new Response(JSON.stringify({ error: "Room and identity are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const at = new AccessToken(apiKey, apiSecret, { identity });
  at.addGrant({ roomJoin: true, room: room });

  const token = await at.toJwt();

  return new Response(JSON.stringify({ token }), {
    headers: { "Content-Type": "application/json" },
  });
});
