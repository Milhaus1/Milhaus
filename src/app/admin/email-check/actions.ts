// src/app/admin/email-check/actions.ts
// Admin → Email check → "Send a test email". Sends one plain email to
// info@milhaus.de through the same code every site email uses (consent
// requests, contact form, expiry warnings) and comes back with Resend's
// own answer, so a broken setting shows up as a sentence on the page
// instead of a silent failure. Added 2026-11-17 — see trySendEmail in
// src/lib/email.ts for what went wrong after the handover.

"use server";

import { redirect } from "next/navigation";
import { trySendEmail } from "@/lib/email";
import { isAdminRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { TRADER } from "@/lib/withdrawal-notice";

export async function sendTestEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/admin/email-check");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAdminRole(profile?.role)) redirect("/");

  const sentAt = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date());

  const result = await trySendEmail({
    to: TRADER.email,
    subject: "Milhaus test email",
    html: `<p>This is a test from Admin → Email check, sent ${sentAt}.</p>
<p>If you can read this, the site's own emails (business consent, contact form, expiry warnings) are working.</p>`,
  });

  redirect(
    result.ok
      ? `/admin/email-check?sent=${encodeURIComponent(TRADER.email)}`
      : `/admin/email-check?error=${encodeURIComponent(result.reason)}`,
  );
}
