import { Resend } from "resend";

const resendApiKey = import.meta.env.VITE_RESEND_API_KEY || "re_mock_key";
export const resend = new Resend(resendApiKey);

export const SENDER_EMAIL = "Latif@resonance.cymatichub.xyz";

export async function sendInviteEmail(
  toEmail: string,
  inviteUrl: string,
  orgName = "Cymatic Workspace",
) {
  try {
    const { data, error } = await resend.emails.send({
      from: `Cymatic Resonance <${SENDER_EMAIL}>`,
      to: [toEmail],
      subject: `You've been invited to join ${orgName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0c; color: #f0f0f5; padding: 32px; border-radius: 16px;">
          <h2 style="color: #6366f1; margin-bottom: 8px;">Workspace Invitation</h2>
          <p style="color: #a1a1aa; font-size: 14px;">You have been invited to join <strong>${orgName}</strong> on Cymatic Resonance.</p>
          <div style="margin: 24px 0;">
            <a href="${inviteUrl}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="color: #71717a; font-size: 12px;">Or paste this link into your browser:<br/><span style="color: #a1a1aa; word-break: break-all;">${inviteUrl}</span></p>
        </div>
      `,
    });
    if (error) {
      console.error("[Resend] Failed to send invite email:", error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error("[Resend] Error sending invite email:", err);
    return { success: false, error: err };
  }
}

export async function sendNotificationEmail(
  toEmail: string,
  subject: string,
  message: string,
  actionUrl?: string,
  actionText = "View in Workspace",
) {
  try {
    const { data, error } = await resend.emails.send({
      from: `Cymatic Resonance <${SENDER_EMAIL}>`,
      to: [toEmail],
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0c; color: #f0f0f5; padding: 32px; border-radius: 16px;">
          <h2 style="color: #6366f1; margin-bottom: 8px;">${subject}</h2>
          <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">${message}</p>
          ${
            actionUrl
              ? `
            <div style="margin: 24px 0;">
              <a href="${actionUrl}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">${actionText}</a>
            </div>
          `
              : ""
          }
          <p style="color: #71717a; font-size: 12px; margin-top: 32px;">Cymatic Resonance Operational Intelligence · <span style="font-family: monospace;">${SENDER_EMAIL}</span></p>
        </div>
      `,
    });
    if (error) {
      console.error("[Resend] Failed to send notification email:", error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error("[Resend] Error sending notification email:", err);
    return { success: false, error: err };
  }
}
