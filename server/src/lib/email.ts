import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "Technet Digital <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!resend) {
    // No API key configured (typical for local dev) — log instead of sending
    // so the reset flow stays usable without a Resend account.
    console.log(`[email] Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  await resend.emails.send({
    from,
    to,
    subject: "Reset your Technet Digital password",
    html: `
      <p>A password reset was requested for your Technet Digital account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}
