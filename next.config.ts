// next.config.ts
// Next.js build/runtime config: allowed dev origins, which remote image
// hosts next/image may optimize, the next-intl plugin (translations) and
// the Sentry wrapper (error reporting + optional source-map upload).
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Next's dev server only trusts requests to its internal dev assets from
  // the "localhost" origin by default. Supabase's own default local config
  // (`supabase init`'s site_url) sends magic-link redirects to
  // 127.0.0.1:3000 instead — a different origin as far as this check is
  // concerned, even though it's the same machine. Without this, following
  // a local magic-link email silently breaks client-side hydration for the
  // rest of that browser session (assets 403, no React event handlers ever
  // attach) with no visible error beyond a console warning easy to miss.
  allowedDevOrigins: ["127.0.0.1"],
  // next/image refuses to optimize a remote image unless its host is
  // explicitly allow-listed here — every listing/business/event photo in
  // this app is a Supabase Storage URL. Wildcarded to *.supabase.co (not
  // the specific project ref) so this doesn't need touching if the
  // project ever moves to a different ref; scoped to the public storage
  // object path rather than the whole domain.
  // Form submissions (server actions) are capped at 1 MB by default.
  // Advertisers' artwork is often bigger — Charlie's ad image uploads
  // (Admin → Ads, 2026-11-13) allow up to 3 MB, so the cap is 4 MB to fit
  // the image plus the rest of the form. Vercel accepts up to 4.5 MB.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
    // Fewer image resizes on Vercel's free plan (Terry, 2026-11-21). The
    // free plan allows 5,000 "image transformations" per 30 days; before
    // the handover the old Milhaus project used about 3,800 a month with
    // mostly demo content, so a busier site would run out and photos could
    // stop loading until the 30 days roll over. Two settings cut that:
    //  - Keep each resized photo for 31 days instead of Next.js's default
    //    4 hours, so the same photo isn't resized again and again. Safe
    //    because a replaced photo always gets a new address: uploads use
    //    new file names, and profile pictures add ?v=<time>.
    //  - 6 image widths instead of the default 16, so each photo has fewer
    //    resized copies. 128–384 cover logos and small pictures (at 2× on
    //    sharp screens), 640 cards on phones and 2× card grids, 1080 and
    //    1920 the wide hero and full-width photos.
    minimumCacheTTL: 2678400, // 31 days, in seconds
    imageSizes: [128, 256, 384],
    deviceSizes: [640, 1080, 1920],
  },
};

// SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN are all optional here — unset
// (as they are until someone wires up a CI upload step), this just skips
// the source-map upload rather than failing the build. Error reporting
// itself doesn't need them at all; source maps only make stack traces in
// Sentry readable instead of pointing at minified code.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
