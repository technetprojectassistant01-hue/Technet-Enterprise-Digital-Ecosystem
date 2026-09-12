import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "Technet Digital <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Whether a reset email can actually be delivered. Callers must check this before telling anyone
 * to go and look in their inbox.
 *
 * Without a key, sending is a console log (see below) - harmless in dev, dangerous in production,
 * because password recovery is the only self-service credential path that still exists (CLAUDE.md
 * §20) and a silent no-op would leave an admin waiting for a mail that is never coming.
 */
export const isEmailConfigured = resend !== null;

if (!isEmailConfigured && process.env.NODE_ENV === "production") {
  console.warn(
    "[email] RESEND_API_KEY is not set - password reset emails cannot be sent. " +
      "Admin password recovery is unavailable until it is configured; make sure a second ADMIN " +
      "account exists so admins can reset each other.",
  );
}

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
