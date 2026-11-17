// src/app/admin/email-check/page.tsx
// Admin → Email check: shows whether the live site's two email settings
// (RESEND_API_KEY and EMAIL_FROM in Vercel) look right, and sends a test
// email with Resend's exact answer. Added 2026-11-17, the day after the
// handover, when consent and contact-form emails silently stopped and
// three rounds of guessing at Vercel's settings didn't find why (the
// suspect: an API key pasted into EMAIL_FROM). Charlie can use it on his own
// whenever emails seem to be missing. The key itself is never shown.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sendTestEmail } from "@/app/admin/email-check/actions";
import { emailSettingsSummary } from "@/lib/email";
import { isAdminRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Email check",
  robots: { index: false, follow: false },
};

function Row({ label, ok, children }: { label: string; ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-canvas-deep py-4 last:border-0 sm:flex-row sm:gap-6">
      <p className="w-48 shrink-0 font-mono text-xs uppercase tracking-wider text-ink-soft">{label}</p>
      <div className="text-sm text-charcoal">
        <span className={`mr-2 font-semibold ${ok ? "text-olive-deep" : "text-rust"}`}>{ok ? "✓ OK" : "✗ Needs fixing"}</span>
        {children}
      </div>
    </div>
  );
}

export default async function EmailCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/admin/email-check");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAdminRole(profile?.role)) redirect("/");

  const { sent, error } = await searchParams;
  const settings = emailSettingsSummary();

  return (
    <main className="flex-1 py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-8">
        <Link href="/admin" className="mb-2 inline-block text-sm text-ink-soft hover:text-ink">
          ← Admin
        </Link>
        <h1 className="mb-2 font-display text-3xl font-semibold text-ink">Email check</h1>
        <p className="mb-8 max-w-[60ch] text-ink-soft">
          The site sends its own emails — business consent requests, contact-form messages, expiry
          warnings — through Resend. If they seem to go missing, check here first. (Sign-in codes are
          sent by Supabase and are set up separately.)
        </p>

        {sent && (
          <p role="status" className="mb-6 rounded-md border border-olive/30 bg-olive/10 px-4 py-3 text-sm text-olive-deep">
            Test email sent to {sent}. Check that inbox (and its spam folder) in a minute.
          </p>
        )}
        {error && (
          <p role="alert" className="mb-6 rounded-md border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">
            The test email was not sent. {error}
          </p>
        )}

        <div className="mb-8 rounded-md border border-canvas-deep bg-paper px-5">
          <Row label="RESEND_API_KEY" ok={settings.keySet && settings.keyLooksRight}>
            {!settings.keySet
              ? "Not set. Add it in Vercel → Settings → Environment Variables, then redeploy."
              : settings.keyLooksRight
                ? `Set (${settings.keyLength} characters, starts with re_ as it should).`
                : "Set, but it doesn't look like a Resend key — it should start with re_ and have no spaces. Paste the key again."}
          </Row>
          <Row label="EMAIL_FROM" ok={settings.fromLooksRight}>
            {!settings.from ? (
              "Not set. In Vercel it should be exactly: Milhaus <info@milhaus.de> — then redeploy."
            ) : settings.from.startsWith("re_") ? (
              "This holds an API key, not a sender. Change it in Vercel to exactly: Milhaus <info@milhaus.de> — then redeploy."
            ) : (
              <>
                Currently <code className="rounded bg-canvas-deep/60 px-1">{settings.from}</code>
                {settings.fromLooksRight ? "." : " — it should be exactly: Milhaus <info@milhaus.de>. Change it in Vercel, then redeploy."}
              </>
            )}
          </Row>
        </div>

        <form action={sendTestEmail}>
          <button
            type="submit"
            className="rounded-md bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-ink-soft"
          >
            Send a test email to info@milhaus.de
          </button>
        </form>
      </div>
    </main>
  );
}
