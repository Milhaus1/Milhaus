// src/lib/email.ts
// Server-only transactional email sending via Resend's HTTP API — a
// plain fetch call rather than their SDK. Brought back specifically for
// the business consent-confirmation email (src/lib/consent-email.ts):
// Stripe's own receipt emails cover payments, but there's no equivalent
// for "please confirm you consent to being listed" — that's not
// something any payment provider can send. Auth emails are still
// Supabase's own, configured as SMTP in the Supabase dashboard (see
// supabase/SETUP.md) — unrelated to this. Never import this from a
// "use client" component: RESEND_API_KEY must never reach the browser.

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Where a reply goes instead of the no-reply sender — e.g. an
   * advertiser replying with their artwork. */
  replyTo?: string;
};

/** Best-effort: logs and returns false instead of throwing when email
 * isn't configured yet, or when Resend rejects the request. A consent
 * request that can't be emailed yet shouldn't block the submission
 * itself — Charlie can still record consent manually (paper form,
 * verbal) while Resend isn't set up. */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  return (await trySendEmail(input)).ok;
}

export type SendEmailResult = { ok: true } | { ok: false; reason: string };

/** Same as sendEmail, but says why a send failed, in words Charlie can
 * act on. Split out 2026-11-17 for Admin → Email check: after the
 * handover the site's emails silently stopped, and the only clue was a
 * line in Vercel's logs that nobody could find (the suspect: an API key pasted into EMAIL_FROM,
 * which should be the sender address). */
export async function trySendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn(
      "[email] Skipping send — RESEND_API_KEY / EMAIL_FROM are not set. " +
        "Copy .env.example to .env.local and fill in a Resend API key and a " +
        "sender address on a domain verified with Resend.",
    );
    const missing = [!apiKey && "RESEND_API_KEY", !from && "EMAIL_FROM"].filter(Boolean).join(" and ");
    return { ok: false, reason: `${missing} is not set in Vercel (or the site wasn't redeployed after setting it).` };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[email] Resend rejected the send (${response.status}): ${body}`);
      let message = body;
      try {
        message = (JSON.parse(body) as { message?: string }).message ?? body;
      } catch {
        // Not JSON — keep the raw text.
      }
      return { ok: false, reason: `Resend refused it (${response.status}): ${message}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("[email] Failed to send:", error);
    return { ok: false, reason: `Couldn't reach Resend: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** What the live site sees for its email settings, safe to show on an
 * admin page: never the key itself, only whether it looks like a Resend
 * key. EMAIL_FROM isn't secret (it's the From line of every email). */
export function emailSettingsSummary() {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const from = process.env.EMAIL_FROM ?? "";
  return {
    keySet: apiKey.length > 0,
    keyLooksRight: apiKey.startsWith("re_") && !/\s/.test(apiKey),
    keyLength: apiKey.length,
    from,
    fromLooksRight: /^[^<>]*<[^@\s<>]+@milhaus\.de>$|^[^@\s<>]+@milhaus\.de$/.test(from.trim()) && from === from.trim(),
  };
}
