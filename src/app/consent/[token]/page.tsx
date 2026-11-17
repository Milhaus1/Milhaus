// src/app/consent/[token]/page.tsx
// Where the business consent-confirmation email actually lands. No
// auth wall — whoever clicks this almost certainly has no Milhaus
// account, by design (see src/lib/consent-email.ts).
//
// The buttons are a plain form post to ./respond (not a server action)
// since 2026-11-17 — see respond/route.ts for the crash that caused. A
// link for a business that no longer exists (deleted, e.g. an old test)
// says so in words instead of a bare "404" (same day, Terry's report).

import { getBusinessByConsentToken } from "@/lib/businesses-queries";

type Params = Promise<{ token: string }>;

export default async function ConsentPage({ params }: { params: Params }) {
  const { token } = await params;
  const business = await getBusinessByConsentToken(token);
  if (!business) {
    return (
      <main className="flex-1 py-14">
        <div className="mx-auto max-w-[480px] px-8 text-center">
          <p className="mb-2 font-display text-xl font-semibold text-ink">This link is no longer valid</p>
          <p className="text-sm text-ink-soft">
            The listing it was for has been removed from Milhaus, so there&apos;s nothing to confirm. If
            you think this is a mistake, write to info@milhaus.de.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 py-14">
      <div className="mx-auto max-w-[480px] px-8 text-center">
        {business.consentStatus === "confirmed" ? (
          <>
            <p className="mb-2 font-display text-xl font-semibold text-ink">Thanks — confirmed</p>
            <p className="text-sm text-ink-soft">
              {business.name} is confirmed for the Military-Friendly Businesses directory. Charlie will
              take it from here.
            </p>
          </>
        ) : business.consentStatus === "revoked" ? (
          <>
            <p className="mb-2 font-display text-xl font-semibold text-ink">Noted</p>
            <p className="text-sm text-ink-soft">
              This listing for {business.name} has been taken down and won&apos;t go live.
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 font-display text-xl font-semibold text-ink">Confirm your business listing</p>
            <p className="mb-6 text-sm text-ink-soft">
              Someone has submitted <strong>{business.name}</strong> to be listed in the Military-Friendly
              Businesses directory on Milhaus. If that&apos;s you — the owner, or someone authorized to
              speak for the business — confirm below. If you don&apos;t recognize this, you can decline
              instead; nothing goes live without your confirmation either way.
            </p>

            <form
              method="post"
              action={`/consent/${encodeURIComponent(token)}/respond`}
              className="flex flex-col gap-3 sm:flex-row sm:justify-center"
            >
              <button
                type="submit"
                name="answer"
                value="yes"
                className="w-full rounded-md bg-brass px-5 py-2.5 text-sm font-semibold text-paper transition-[transform,box-shadow] hover:-translate-y-px hover:bg-brass-deep sm:w-auto"
              >
                Yes, confirm this listing
              </button>
              <button
                type="submit"
                name="answer"
                value="no"
                className="w-full rounded-md border border-canvas-deep px-5 py-2.5 text-sm font-semibold text-ink-soft transition-[transform] hover:-translate-y-px hover:border-rust hover:text-rust sm:w-auto"
              >
                No, this isn&apos;t mine
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
