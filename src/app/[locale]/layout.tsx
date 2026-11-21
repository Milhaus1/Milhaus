// src/app/[locale]/layout.tsx
// Root layout, now locale-scoped: [locale] sits directly under app/, so
// this is the actual <html>/<body> root (no separate app/layout.tsx above
// it) — see src/i18n/routing.ts for why "en" has no URL prefix.

import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { montserrat } from "@/app/fonts";
import { ConditionalAnalytics } from "@/components/conditional-analytics";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { ServicePopup } from "@/components/service-popup";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PromoBanner } from "@/components/promo-banner";
import { routing } from "@/i18n/routing";
import { DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/seo";
import { SITE_URL } from "@/lib/site-url";
import "../globals.css";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const title = t("title");
  const description = t("description");

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s — ${SITE_NAME}` },
    description,
    robots: { index: true, follow: true },
    // Fallbacks only — every public page sets its own canonical, hreflang
    // and share card through pageMetadata (src/lib/seo.ts). There's
    // deliberately no `alternates` here: a layout-level one made every
    // page's hreflang point at the homepage.
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      locale: locale === "de" ? "de_DE" : "en_US",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [DEFAULT_OG_IMAGE.url] },
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enables static rendering for this locale — see next-intl docs on
  // setRequestLocale. Must run before anything below reads translations.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${montserrat.variable} h-full antialiased`}
      // Browser extensions (screen recorders, password managers, etc.) can
      // inject attributes onto <html> before React hydrates — a genuine
      // client/server mismatch, but not one caused by this app, and not
      // one worth React bailing out over. suppressHydrationWarning only
      // silences attribute/text mismatches on this exact element, not
      // anything inside it.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-body">
        <NextIntlClientProvider>
          <SiteHeader />
          {/* Only while the "free until" promo runs (2026-11-11). */}
          <PromoBanner />
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter />
          <CookieConsentBanner />
          {/* Charlie's Milhaus Service pop-up (2026-11-09) — after 30
              seconds, once per visit. */}
          <ServicePopup />
        </NextIntlClientProvider>
        {/* No-op until deployed to Vercel (that's what activates it) —
            and now also until a visitor accepts the cookie banner above;
            see ConditionalAnalytics' own comment for why. */}
        <ConditionalAnalytics />
      </body>
    </html>
  );
}
