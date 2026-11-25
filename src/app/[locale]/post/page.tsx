// src/app/[locale]/post/page.tsx
// Post-a-listing (build order step 6). Signed-in-only, always
// self-listed — an admin can also add one directly at
// /admin/listings/new (same form, different variant). ?for=sale posts a
// home for sale instead of for rent, at its own posting price;
// ?for=temporary posts temporary living (2026-11-25), priced per night,
// also at its own posting price.
//
// ?copy=<id> ("Copy" on My Listings, 2026-11-25) fills the form with
// another of the poster's own homes — for companies with many similar
// places. Only their own: anyone can read a live listing, so finding it
// proves nothing.

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ListingForm } from "@/components/listing-form";
import { PostingPriceNotice } from "@/components/posting-price-notice";
import { getPathname, redirect } from "@/i18n/navigation";
import { getPostingPriceForProfile, homePriceType, offerFromParam } from "@/lib/listing-prices";
import { getListingById } from "@/lib/listings";
import { getProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "List your home",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ for?: string; copy?: string }>;

export default async function PostListingPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("PostPage");
  const { for: forParam, copy } = await searchParams;
  const offer = offerFromParam(forParam);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const locale = await getLocale();
    const query = new URLSearchParams();
    if (offer !== "rent") query.set("for", offer);
    if (copy) query.set("copy", copy);
    const nextPath = getPathname({ href: `/post${query.size ? `?${query}` : ""}`, locale });
    redirect({ href: `/sign-in?next=${encodeURIComponent(nextPath)}`, locale });
    return;
  }

  const [profile, copied] = await Promise.all([getProfile(user.id), copy ? getListingById(copy) : null]);
  const template = copied && copied.ownerId === user.id && copied.type === "rental" ? copied : undefined;
  const priceEur = await getPostingPriceForProfile(homePriceType(offer), profile?.isIndividualLister ?? false);

  return (
    <main className="flex-1 py-14">
      <div className="mx-auto max-w-[640px] px-8">
        <h1 className="mb-2 font-display text-3xl font-semibold text-ink">
          {offer === "sale" ? t("saleHeading") : offer === "temporary" ? t("temporaryHeading") : t("heading")}
        </h1>
        <p className="mb-8 text-ink-soft">
          {offer === "sale" ? t("saleBody") : offer === "temporary" ? t("temporaryBody") : t("body")}
        </p>
        {template && (
          <p role="status" className="mb-6 rounded-md border border-olive/30 bg-olive/10 px-4 py-3 text-sm text-olive-deep">
            {t("copyNote", { title: template.title })}
          </p>
        )}
        {priceEur !== null && <PostingPriceNotice priceEur={priceEur} />}
        <ListingForm variant="self-list" priceEur={priceEur} offerType={offer} template={template} />
      </div>
    </main>
  );
}
