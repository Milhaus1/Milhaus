// src/app/[locale]/listings/page.tsx
// Browse homes — the dedicated Homes category page the Unified Category
// UX spec calls for (Top Navigation → Sponsored Banner → Top Horizontal
// Filter Bar → Item Grid), matching /cars, /products, /services.
//
// This didn't exist before: Homes browsing only ever lived embedded in
// the homepage's "Open right now" section, reached via a "/#listings"
// hash link. That meant "View all homes" just scrolled you back down to
// the same section already visible on the page you were on — reported
// directly ("Opens a new page and not scrolled down"). This page is the
// fix: a real separate page, same as every other category gets.
//
// Two halves since 2026-11-04 (Charlie's homes-for-sale ask): a
// For rent | For sale switch at the top, each with its own address
// (/listings and /listings?for=sale) so both can be linked and found on
// their own. The filters below only ever see one half, so a rent price
// range never gets mixed up with sale prices.
//
// A third tab since 2026-11-25: Temporary (/listings?for=temporary) —
// furnished short stays priced per night, for the many temporary-living
// companies around the bases (see 20261125120000_add_temporary_living.sql).

import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ListingsGrid } from "@/components/listings-grid";
import { SponsorBannerCarousel } from "@/components/sponsor-banner-carousel";
import { Link } from "@/i18n/navigation";
import { getFavoriteListingIds } from "@/lib/favorites-queries";
import { offerFromParam } from "@/lib/listing-prices";
import { getActiveListings } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ q?: string; for?: string }>;

const TAB_PATHS = { rent: "/listings", sale: "/listings?for=sale", temporary: "/listings?for=temporary" } as const;
const POST_PATHS = { rent: "/post", sale: "/post?for=sale", temporary: "/post?for=temporary" } as const;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const t = await getTranslations("ListingsPage");
  const offer = offerFromParam((await searchParams).for);
  // Each tab is its own page as far as search goes — the For sale and
  // Temporary tabs' canonicals keep their ?for= rather than folding into
  // /listings.
  return pageMetadata({
    locale: await getLocale(),
    path: TAB_PATHS[offer],
    title: offer === "sale" ? t("saleMetaTitle") : offer === "temporary" ? t("temporaryMetaTitle") : t("metaTitle"),
    description:
      offer === "sale"
        ? t("saleMetaDescription")
        : offer === "temporary"
          ? t("temporaryMetaDescription")
          : t("metaDescription"),
  });
}

export default async function ListingsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("ListingsPage");
  const { q, for: forParam } = await searchParams;
  const offer = offerFromParam(forParam);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [allHomes, favoriteIds] = await Promise.all([
    getActiveListings("rental"),
    getFavoriteListingIds(user?.id),
  ]);
  const listings = allHomes.filter((home) => home.offerType === offer);

  const tabClass = (active: boolean) =>
    `flex-1 rounded-[5px] px-5 py-2 text-center text-sm font-semibold transition-colors sm:flex-none ${
      active ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
    }`;

  return (
    <main className="flex-1">
      <SponsorBannerCarousel />
      <div className="mx-auto max-w-[1600px] px-8 py-8 sm:py-11 lg:py-14">
        <nav
          aria-label={t("tabsLabel")}
          className="mb-6 flex w-full rounded-md border border-canvas-deep bg-paper p-1 sm:inline-flex sm:w-auto"
        >
          {(["rent", "sale", "temporary"] as const).map((tab) => (
            <Link key={tab} href={TAB_PATHS[tab]} aria-current={offer === tab ? "page" : undefined} className={tabClass(offer === tab)}>
              {tab === "rent" ? t("tabRent") : tab === "sale" ? t("tabSale") : t("tabTemporary")}
            </Link>
          ))}
        </nav>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-display text-[clamp(1.5rem,7.5vw,2rem)] font-semibold text-ink">
              {offer === "sale" ? t("saleHeading") : offer === "temporary" ? t("temporaryHeading") : t("heading")}
            </h1>
            <p className="mt-1 max-w-[52ch] text-ink-soft">
              {offer === "sale" ? t("saleSubhead") : offer === "temporary" ? t("temporarySubhead") : t("subhead")}
            </p>
          </div>
          <Link
            href={POST_PATHS[offer]}
            className="whitespace-nowrap rounded-md bg-brass px-5 py-2.5 text-sm font-semibold text-paper transition-[transform,box-shadow] hover:-translate-y-px hover:bg-brass-deep"
          >
            {offer === "sale" ? t("postAHomeForSale") : offer === "temporary" ? t("postTemporary") : t("postAHome")}
          </Link>
        </div>

        <Suspense fallback={null}>
          {/* key: switching tabs starts the grid's typed-in search and
              pending filters fresh rather than carrying them across. */}
          <ListingsGrid
            key={offer}
            listings={listings}
            favoriteIds={user ? Array.from(favoriteIds) : null}
            initialQuery={q}
            offer={offer}
          />
        </Suspense>
      </div>
    </main>
  );
}
