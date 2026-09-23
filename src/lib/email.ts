/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { resend, SENDER_EMAIL } from "./resend";

export type EmailPayload = {
  to: string;
  subject: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  category?: "invites" | "tasks" | "pulse" | "general";
};

/**
 * Secure email gateway abstraction layer.
 * 1. Checks user preferences in Supabase before dispatching.
 * 2. Routes through secure Resend API gateway.
 * 3. Logs email activity for analytics.
 */
export async function sendSecureEmail(payload: EmailPayload) {
  try {
    // 1. Check recipient user preferences if user exists in profiles
    const { data: profile } = await (supabase.from("profiles" as any) as any)
      .select("id")
      .eq("email", payload.to)
      .maybeSingle();

    if (profile?.id) {
      const { data: prefs } = await (supabase.from("user_preferences" as any) as any)
        .select("email_notifications, task_alerts, pulse_alerts")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (prefs) {
        if (prefs.email_notifications === false) {
          console.info(`[EmailGateway] Email suppressed by user preference for ${payload.to}`);
          return { success: false, reason: "suppressed_by_user_preference" };
        }
        if (payload.category === "tasks" && prefs.task_alerts === false) {
          return { success: false, reason: "task_alerts_disabled" };
        }
        if (payload.category === "pulse" && prefs.pulse_alerts === false) {
          return { success: false, reason: "pulse_alerts_disabled" };
        }
      }
    }

    // 2. Dispatch via Resend
    const response = await resend.emails.send({
      from: `Cymatic Resonance <${SENDER_EMAIL}>`,
      to: [payload.to],
      subject: payload.subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0c; color: #f0f0f5; padding: 32px; border-radius: 16px;">
          <h2 style="color: #6366f1; margin-bottom: 8px;">${payload.subject}</h2>
          <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">${payload.message}</p>
          ${
            payload.actionUrl
              ? `
            <div style="margin: 24px 0;">
              <a href="${payload.actionUrl}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">${payload.actionText || "View in Workspace"}</a>
            </div>
          `
              : ""
          }
          <p style="color: #71717a; font-size: 12px; margin-top: 32px;">Cymatic Resonance Secure Gateway · <span style="font-family: monospace;">${SENDER_EMAIL}</span></p>
        </div>
      `,
    });

    if (response.error) {
      console.error("[EmailGateway] Resend dispatch error:", response.error);
      return { success: false, error: response.error };
    }

    const emailId = response.data?.id;

    // 3. Log activity into email_activity table for analytics
    if (emailId) {
      await (supabase.from("email_activity" as any) as any).insert({
        email_id: emailId,
        event_type: "sent",
        recipient: payload.to,
        subject: payload.subject,
      });
    }

    return { success: true, emailId };
  } catch (err) {
    console.error("[EmailGateway] Critical dispatch failure:", err);
    return { success: false, error: err };
  }
}
