import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const livekitUrl = Deno.env.get("LIVEKIT_URL");

    if (!apiKey || !apiSecret || !livekitUrl) {
      // Not an error: the client falls back to direct peer-to-peer calling.
      return json({ available: false, reason: "livekit_not_configured" }, 200);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const roomName = typeof body.roomName === "string" ? body.roomName.slice(0, 120) : "";
    if (!roomName) return json({ error: "roomName is required" }, 400);

    const at = new AccessToken(apiKey, apiSecret, { identity: user.id, ttl: 60 * 60 });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      roomAdmin: body.isHost === true,
    });

    return json({ available: true, token: await at.toJwt(), url: livekitUrl });
  } catch (err) {
    console.error("[livekit-token]", err);
    return json({ available: false, reason: "token_error" }, 200);
  }
});
