// src/components/service-popup.tsx
// The 30-second pop-up — Charlie's "Milhaus Service" sign-up (his design,
// 2026-11-09): "Arrive in Stuttgart. We've got your back.", four things
// he can help with (tick any), an email address and "Get in touch with
// us". Until then the site had a no-pop-ups rule (Charlie's own earlier
// preference); this is the one exception he asked for.
//
// History: first built the same day as a paid ad spot sold on
// /advertise, on a misreading of the ask. When Terry saw Charlie's design
// he had that spot removed (supabase/migrations/20261109210000_service_popup.sql).
// The layout here was built from a blurry photo of the design; adjust it
// when Charlie's original file arrives. His "Milhaus Service" logo artwork
// arrived on 2026-11-11 and is now used as is (see the logo below).
//
// When it appears (unchanged from the first version, tested in the
// browser on 2026-11-09):
//   - Not in the first 30 seconds of a visit. The clock starts on the
//     first page of the visit and keeps running across pages
//     (sessionStorage), so moving around the site doesn't restart it.
//   - At most once per visit (Charlie, 2026-11-09 — first built as once
//     a day): once it has appeared it won't appear again until the
//     visitor comes back in a new browser session (sessionStorage, which
//     the browser clears when the site's tabs are closed).
//   - Never while the cookie banner is still waiting for an answer —
//     it waits until the visitor has chosen, then appears 10 seconds
//     later (Terry, 2026-11-11 — it was 4 seconds, which felt like it
//     jumped up straight after Accept/Decline).
//   - Never on pages where someone is filling in a form or reading a
//     legal text (posting, editing, signing in, contact, withdrawal,
//     terms, privacy, Impressum). If the 30 seconds run out on one of
//     those pages, it waits for the next ordinary page.
// If the browser blocks storage, it shows once per page load after 30
// seconds rather than failing.
//
// Add ?popup to a page address to open it immediately: on localhost for
// anyone, on the live site only for a signed-in admin (see the shortcut
// below).
//
// No "Ad" label: it's Milhaus's own service on Milhaus's own site, not a
// paid ad for someone else. Closes with the × button, the Escape key or
// a click outside it; focus moves to the × so keyboard users can close
// it too. After sending, the thank-you stays in the pop-up until closed.

"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { COOKIE_CONSENT_EVENT, getStoredConsent } from "@/lib/cookie-consent";
import { canPreviewPopup } from "@/lib/popup-preview";
import { SERVICE_EMAIL, SERVICE_INTERESTS, type ServiceInterest } from "@/lib/milhaus-service";
import { sendServiceRequest, type ServiceRequestResult } from "@/lib/service-request-actions";

const DELAY_MS = 30_000;
/** After the cookie banner is answered, how long before the pop-up. */
const AFTER_CONSENT_MS = 10_000;
const VISIT_START_KEY = "milhaus-visit-started";
const SHOWN_KEY = "milhaus-popup-shown";

/** Path prefixes (without /de) where the pop-up never appears. */
const QUIET_PATHS = ["/post", "/edit-listing", "/sign-in", "/contact", "/withdraw", "/terms", "/privacy", "/impressum"];

const INTEREST_ICONS: Record<ServiceInterest, string> = {
  car: "🚗",
  apartment: "🏠",
  bureaucracy: "📄",
  advice: "💬",
};

function readNumber(key: string): number | null {
  try {
    const value = Number(sessionStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number) {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    // Storage blocked — see the header comment.
  }
}

export function ServicePopup() {
  const t = useTranslations("ServicePopup");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const quiet = QUIET_PATHS.some((prefix) => pathname.startsWith(prefix));
  const [result, action, pending] = useActionState<ServiceRequestResult, FormData>(sendServiceRequest, null);

  // Preview shortcut: adding ?popup to any page address opens the pop-up
  // straight away — no 30-second wait, no once-per-visit limit, no
  // cookie-banner wait, even on the quiet pages. Terry's ask, 2026-11-11,
  // on localhost only (`npm run dev`, anyone). Since 2026-11-21 it also
  // works on the live site for a signed-in admin, so Charlie can look at
  // it again after his visit has already shown it (www.milhaus.de/?popup).
  // The admin check is on the server (canPreviewPopup); for anyone else
  // ?popup does nothing and the normal rules apply.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("popup")) return;
    let cancelled = false;
    const allowed =
      process.env.NODE_ENV === "development" ? Promise.resolve(true) : canPreviewPopup().catch(() => false);
    allowed.then((ok) => {
      if (ok && !cancelled) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (open || quiet || readNumber(SHOWN_KEY)) return;

    let visitStart = readNumber(VISIT_START_KEY);
    if (!visitStart) {
      visitStart = Date.now();
      writeNumber(VISIT_START_KEY, visitStart);
    }
    const wait = Math.max(0, visitStart + DELAY_MS - Date.now());

    const show = () => {
      if (readNumber(SHOWN_KEY)) return;
      writeNumber(SHOWN_KEY, Date.now());
      setOpen(true);
    };
    let consentTimer: ReturnType<typeof setTimeout> | undefined;
    const onConsent = () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
      consentTimer = setTimeout(show, AFTER_CONSENT_MS);
    };
    const timer = setTimeout(() => {
      if (getStoredConsent() === null) {
        window.addEventListener(COOKIE_CONSENT_EVENT, onConsent);
      } else {
        show();
      }
    }, wait);

    return () => {
      clearTimeout(timer);
      clearTimeout(consentTimer);
      window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
    };
  }, [open, quiet]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3 sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-popup-heading"
        className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-[#F0EBDE] p-5 text-ink shadow-[0_24px_60px_rgba(16,24,66,0.35)] ring-1 ring-ink/10 sm:p-7"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("close")}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-ink/60 hover:bg-ink/10 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8383C]"
        >
          ×
        </button>

        {/* The "Milhaus Service" artwork. History: Charlie's first artwork
            (2026-11-11) was a JPG on black, so the pop-up was made black to
            match it (Terry), with light text and the artwork's script red
            (#D8383C) as the accent. 2026-11-21: new artwork from Terry —
            navy MILHAUS and red "Service" on a cream rounded panel —
            public/brand/milhaus-service-badge.png (new file name so browsers
            don't show the old logo from their cache). The same day Terry
            asked for the whole pop-up in that cream, so it uses the
            artwork's own cream (#F0EBDE), and the badge file is just the
            wordmark: the panel's cream and the white around it made
            transparent, so no panel edge shows. Text is navy, the boxes are
            lighter "paper", and the red stays the accent. */}
        <div className="mb-5 mt-3 px-6 sm:px-8">
          <Image
            src="/brand/milhaus-service-badge.png"
            alt="Milhaus Service"
            width={901}
            height={286}
            // Load at once: the pop-up only exists while it's open, so
            // there's nothing to gain from lazy loading its one picture.
            loading="eager"
            className="mx-auto h-auto w-full max-w-[320px]"
          />
        </div>

        <h2
          id="service-popup-heading"
          className="mb-3 text-right font-display text-[1.45rem] font-bold leading-tight text-ink sm:text-[1.7rem]"
        >
          {t("headingLine1")}
          <br />
          {t("headingLine2")}
        </h2>
        <p className="mb-5 text-[0.9rem] leading-snug text-ink-soft">{t("intro")}</p>

        {result?.ok ? (
          <div role="status" className="rounded-xl bg-paper p-5 text-center ring-1 ring-ink/10">
            <p className="mb-1 font-display text-lg font-semibold text-ink">{t("sentHeading")}</p>
            <p className="text-sm text-ink-soft">{t("sentBody")}</p>
          </div>
        ) : (
          <form action={action} className="rounded-xl bg-paper/80 p-3 ring-1 ring-ink/10 sm:p-5">
            <fieldset>
              <legend className="mb-3 font-mono text-[0.66rem] font-semibold uppercase tracking-wider text-ink-soft">
                {t("helpLegend")} <span className="font-normal text-ink-soft/60">{t("selectAny")}</span>
              </legend>
              <div className="mb-4 grid grid-cols-2 gap-1.5 sm:gap-2">
                {SERVICE_INTERESTS.map((interest) => (
                  <label
                    key={interest}
                    className="flex cursor-pointer items-center gap-1 rounded-lg border border-ink/15 bg-paper px-2 py-2.5 text-[0.7rem] font-medium text-ink hover:border-ink/35 has-[:checked]:border-[#D8383C] has-[:checked]:bg-[#D8383C]/10 sm:gap-2 sm:px-2.5 sm:text-[0.85rem]"
                  >
                    <input type="checkbox" name="interests" value={interest} className="h-4 w-4 flex-shrink-0 accent-[#D8383C]" />
                    <span aria-hidden="true">{INTEREST_ICONS[interest]}</span>
                    {/* min-w-0 + hyphens: long German words ("Wohnungssuche")
                        ran out of the tile on phones. After the switch to the
                        wider Montserrat (2026-11-21), "Registration" and
                        "Bureaucracy" split mid-word on a 390px phone, so the
                        tiles are a little tighter and smaller below sm. */}
                    <span className="min-w-0 hyphens-auto break-words">{t(`interest_${interest}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label
              htmlFor="service-popup-email"
              className="mb-1.5 block font-mono text-[0.66rem] font-semibold uppercase tracking-wider text-ink-soft"
            >
              {t("emailLabel")}
            </label>
            <div className="relative mb-4">
              <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/60">
                ✉
              </span>
              <input
                id="service-popup-email"
                name="email"
                type="email"
                required
                maxLength={320}
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                className="w-full rounded-lg border border-ink/20 bg-paper py-2.5 pl-9 pr-3 text-[0.95rem] text-charcoal placeholder:text-charcoal/40 focus:border-[#D8383C] focus:outline-none"
              />
            </div>
            <input type="hidden" name="page" value={pathname} />
            {/* Honeypot — hidden from people, see service-request-actions.ts. */}
            <div className="hidden" aria-hidden="true">
              <input name="website" tabIndex={-1} autoComplete="off" />
            </div>

            {result && !result.ok && (
              <p role="alert" className="mb-3 rounded-md bg-[#D8383C]/10 px-3 py-2 text-sm text-[#A8262B]">
                {result.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-[#C42F34] px-5 py-3 text-sm font-semibold text-white transition-[transform,background-color] hover:-translate-y-px hover:bg-[#A8262B] disabled:opacity-60"
            >
              {pending ? t("sending") : `${t("submit")} ➤`}
            </button>
            <p className="mt-3 text-center text-[0.72rem] text-ink-soft">
              {t("orEmail")}{" "}
              <a href={`mailto:${SERVICE_EMAIL}`} className="font-semibold text-ink underline">
                {SERVICE_EMAIL}
              </a>
            </p>
            <p className="mt-1 text-center text-[0.68rem] text-ink-soft/70">{t("privacyNote")}</p>
          </form>
        )}
      </div>
    </div>
  );
}
