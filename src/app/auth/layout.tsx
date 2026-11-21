// src/app/auth/layout.tsx
// Root layout for the chrome-free auth pages that live outside
// src/app/[locale] (currently just the magic-link confirm interstitial).
// Same reasoning as src/app/admin/layout.tsx: Next.js nests layouts by
// directory, so the only way for /auth/* to have its own <html>/<body>
// root — not share one with /de/... — is for neither to have a common
// ancestor layout. English-only: these are transient auth screens, not in
// scope for translation. No SiteHeader/SiteFooter here (and so no
// NextIntlClientProvider) — a page you hit mid-sign-in shouldn't carry the
// full site nav.

import type { Metadata } from "next";
import { montserrat } from "@/app/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "milhaus",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} h-full antialiased`}
      // See src/app/[locale]/layout.tsx — same browser-extension
      // attribute-injection issue, same fix.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-body">{children}</body>
    </html>
  );
}
