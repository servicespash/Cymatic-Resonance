import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEV_EMAIL = "cymatichubevolution@gmail.com";
const DEV_WHATSAPP = "256768715065";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const report = await req.json().catch(() => null);
    if (!report || typeof report.issue !== "string") {
      return json({ error: "issue is required" }, 400);
    }

    const trace: string[] = Array.isArray(report.consoleTrace)
      ? report.consoleTrace.slice(-10).map(String)
      : [];

    const text = [
      "Cymatic Resonance — Panda Alert",
      `Issue: ${report.issue}`,
      `URL: ${report.url ?? "n/a"}`,
      `Time: ${report.timestamp ?? new Date().toISOString()}`,
      `Device: ${report.userAgent ?? "n/a"}`,
      "",
      "Recent trace:",
      ...trace,
    ].join("\n");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const delivery: Record<string, string> = {};

    // 1. Always persist the report so nothing is lost.
    const { error: insertError } = await admin.from("panda_reports").insert({
      issue: String(report.issue).slice(0, 2000),
      url: report.url ?? null,
      user_agent: report.userAgent ?? null,
      console_trace: trace,
    });
    delivery.stored = insertError ? `failed: ${insertError.message}` : "ok";

    // 2. Email via Resend when configured.
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: Deno.env.get("PANDA_FROM_EMAIL") ?? "Panda Ping <onboarding@resend.dev>",
          to: [Deno.env.get("PANDA_TO_EMAIL") ?? DEV_EMAIL],
          subject: `🐼 Panda Ping: ${String(report.issue).slice(0, 80)}`,
          text,
        }),
      });
      delivery.email = res.ok ? "sent" : `failed: ${await res.text()}`;
    } else {
      delivery.email = "skipped: RESEND_API_KEY not set";
    }

    // 3. WhatsApp via Meta Cloud API when configured.
    const waToken = Deno.env.get("WHATSAPP_TOKEN");
    const waPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    if (waToken && waPhoneId) {
      const res = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${waToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: Deno.env.get("PANDA_TO_WHATSAPP") ?? DEV_WHATSAPP,
          type: "text",
          text: { body: text.slice(0, 4000) },
        }),
      });
      delivery.whatsapp = res.ok ? "sent" : `failed: ${await res.text()}`;
    } else {
      delivery.whatsapp = "skipped: WHATSAPP_TOKEN not set";
    }

    console.log("[panda-ping] delivery:", delivery);

    const delivered = delivery.email === "sent" || delivery.whatsapp === "sent";
    return json({ ok: true, delivered, delivery });
  } catch (err) {
    console.error("[panda-ping]", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
