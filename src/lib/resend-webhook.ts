/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";

export type ResendWebhookEvent = {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.delivery_delayed"
    | "email.complained"
    | "email.bounced"
    | "email.opened"
    | "email.clicked";
  created_at: string;
  data: {
    created_at: string;
    email_id: string;
    from: string;
    to: string[];
    subject: string;
  };
};

/**
 * Structured handler pattern for processing incoming Resend webhook events
 * and logging them into the email_activity analytics table in Supabase.
 */
export async function handleResendWebhook(event: ResendWebhookEvent) {
  try {
    const emailId = event.data?.email_id;
    const eventType = event.type.replace("email.", "");
    const recipient = event.data?.to?.[0] || "unknown";
    const subject = event.data?.subject || "No Subject";

    if (!emailId) {
      console.warn("[ResendWebhook] Received event without email_id:", event);
      return { success: false, error: "Missing email_id" };
    }

    // Log event into email_activity table
    const { error } = await (supabase.from("email_activity" as any) as any).insert({
      email_id: emailId,
      event_type: eventType,
      recipient,
      subject,
    });

    if (error) {
      console.error("[ResendWebhook] Failed to log email activity in Supabase:", error);
      return { success: false, error: error.message };
    }

    console.info(`[ResendWebhook] Successfully logged ${eventType} event for email ID: ${emailId}`);
    return { success: true, emailId, eventType };
  } catch (err) {
    console.error("[ResendWebhook] Exception handling webhook event:", err);
    return { success: false, error: err };
  }
}
