// src/app/[locale]/edit-business/[id]/page.tsx
// Edit a business in the Military-Friendly Businesses directory — for the
// account that listed it (from My Listings) and for Charlie (from Admin →
// Businesses). Added 2026-11-17; see ./actions.ts for who may change what
// and why the email (and, for non-admins, the name) is locked.
//
// Same fields and labels as /post-business, filled in with what's there
// now. Pictures: leave the file box empty to keep the current one.

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { updateBusiness } from "@/app/[locale]/edit-business/[id]/actions";
import { Link, getPathname, redirect } from "@/i18n/navigation";
import { BASE_NAMES } from "@/lib/bases";
import { BUSINESS_CATEGORY_KEYS, BUSINESS_CATEGORY_LABELS, BUSINESS_TAG_KEYS, BUSINESS_TAG_LABELS } from "@/lib/businesses";
import { getBusiness } from "@/lib/businesses-queries";
import { isAdminRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit business",
  robots: { index: false, follow: false },
};

const labelClass = "mb-1 block font-mono text-[0.68rem] uppercase tracking-wider text-ink-soft/75";
const inputClass =
  "w-full rounded-md border border-canvas-deep bg-paper px-3 py-2 text-[0.95rem] text-charcoal placeholder:text-charcoal/40 focus:border-olive focus:outline-none";
const fileClass =
  "w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-canvas-deep file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink";

export default async function EditBusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("EditBusinessPage");
  const f = await getTranslations("PostBusinessPage");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: `/sign-in?next=${getPathname({ href: `/edit-business/${id}`, locale })}`, locale });
  }

  const [business, { data: profile }] = await Promise.all([
    getBusiness(id),
    supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle(),
  ]);
  const isAdmin = isAdminRole(profile?.role);
  // A live business is readable by anyone, so finding it proves nothing —
  // only its own account or an admin gets the form.
  if (!business || (business.ownerId !== user!.id && !isAdmin)) {
    return (
      <main className="flex-1 py-14">
        <div className="mx-auto max-w-160 px-8">
          <h1 className="mb-2 font-display text-3xl font-semibold text-ink">{t("notYoursHeading")}</h1>
          <p className="text-ink-soft">{t("notYoursBody")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 py-14">
      <div className="mx-auto max-w-160 px-4 sm:px-8">
        {isAdmin ? (
          // Admin lives outside [locale], so not the locale-aware Link.
          <NextLink href="/admin/businesses" className="mb-6 inline-block text-sm text-ink-soft hover:text-ink">
            ← Admin → Businesses
          </NextLink>
        ) : (
          <Link href="/my-listings" className="mb-6 inline-block text-sm text-ink-soft hover:text-ink">
            ← {t("backToMyListings")}
          </Link>
        )}
        <h1 className="mb-2 font-display text-3xl font-semibold text-ink">{t("heading")}</h1>
        <p className="mb-6 text-ink-soft">{t("body")}</p>

        {saved && !error && (
          <p role="status" className="mb-6 rounded-md border border-olive/30 bg-olive/10 px-4 py-3 text-sm text-olive-deep">
            {t("saved")}{" "}
            <Link href={`/businesses/${business.id}`} className="font-semibold underline">
              {t("viewIt")}
            </Link>
          </p>
        )}
        {error && (
          <p role="alert" className="mb-6 rounded-md border border-rust/30 bg-rust/10 px-4 py-3 text-sm text-rust">
            {error}
          </p>
        )}

        <form action={updateBusiness} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={business.id} />

          <div>
            <label htmlFor="name" className={labelClass}>
              {f("name")}
            </label>
            {isAdmin ? (
              <input id="name" name="name" required defaultValue={business.name} className={inputClass} />
            ) : (
              <>
                <p id="name" className={`${inputClass} bg-canvas-deep/30`}>
                  {business.name}
                </p>
                <p className="mt-1 text-xs text-ink-soft/75">{t("nameLocked")}</p>
              </>
            )}
          </div>

          <div>
            <span className={labelClass}>{f("email")}</span>
            <p className={`${inputClass} bg-canvas-deep/30`}>{business.email ?? "—"}</p>
            <p className="mt-1 text-xs text-ink-soft/75">{t("emailLocked")}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className={labelClass}>
                {f("category")}
              </label>
              <select id="category" name="category" required defaultValue={business.category} className={inputClass}>
                {BUSINESS_CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {BUSINESS_CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="base" className={labelClass}>
                {f("nearestBase")}
              </label>
              <select id="base" name="base" defaultValue={business.base ?? ""} className={inputClass}>
                <option value="">{f("notBaseSpecific")}</option>
                {BASE_NAMES.map((base) => (
                  <option key={base} value={base}>
                    {base}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="city" className={labelClass}>
              {f("city")}
            </label>
            <input id="city" name="city" required defaultValue={business.city} className={inputClass} />
          </div>

          <div>
            <span className={labelClass}>{f("tags")}</span>
            <div className="flex flex-wrap gap-4">
              {BUSINESS_TAG_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-charcoal">
                  <input
                    type="checkbox"
                    name={`tag_${key}`}
                    defaultChecked={business.tags.includes(key)}
                    className="h-4 w-4 rounded border-canvas-deep text-olive focus:ring-olive"
                  />
                  <span>{BUSINESS_TAG_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(
              [
                { field: "logo", label: t("logo"), current: business.logoUrl },
                { field: "coverImage", label: t("cover"), current: business.coverImageUrl },
              ] as const
            ).map(({ field, label, current }) => (
              <div key={field}>
                <label htmlFor={field} className={labelClass}>
                  {label}
                </label>
                {current && (
                  // eslint-disable-next-line @next/next/no-img-element -- small preview of an uploaded picture
                  <img
                    src={current}
                    alt=""
                    className={`mb-2 rounded-md border border-canvas-deep object-cover ${field === "logo" ? "h-16 w-16" : "h-16 w-full"}`}
                  />
                )}
                <input id={field} name={field} type="file" accept="image/*" className={fileClass} />
                <p className="mt-1 text-xs text-ink-soft/75">{current ? t("pictureKeep") : t("pictureNone")}</p>
                {current && (
                  <label className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
                    <input type="checkbox" name={`remove_${field}`} className="h-3.5 w-3.5 rounded border-canvas-deep" />
                    {t("pictureRemove")}
                  </label>
                )}
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              {f("description")}
            </label>
            <textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={business.description ?? ""}
              placeholder={f("descriptionPlaceholder")}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="promotion" className={labelClass}>
              {f("promotion")}
            </label>
            <input
              id="promotion"
              name="promotion"
              defaultValue={business.promotion ?? ""}
              placeholder={f("promotionPlaceholder")}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="websiteUrl" className={labelClass}>
                {f("websiteUrl")}
              </label>
              <input
                id="websiteUrl"
                name="websiteUrl"
                type="url"
                defaultValue={business.websiteUrl ?? ""}
                placeholder="https://…"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>
                {f("phone")}
              </label>
              <input id="phone" name="phone" type="tel" defaultValue={business.phone ?? ""} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="instagramUrl" className={labelClass}>
                {f("instagramUrl")}
              </label>
              <input
                id="instagramUrl"
                name="instagramUrl"
                type="url"
                defaultValue={business.instagramUrl ?? ""}
                placeholder="https://instagram.com/…"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="facebookUrl" className={labelClass}>
                {f("facebookUrl")}
              </label>
              <input
                id="facebookUrl"
                name="facebookUrl"
                type="url"
                defaultValue={business.facebookUrl ?? ""}
                placeholder="https://facebook.com/…"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="whatsappNumber" className={labelClass}>
              {f("whatsappNumber")}
            </label>
            <input
              id="whatsappNumber"
              name="whatsappNumber"
              type="tel"
              defaultValue={business.whatsappNumber ?? ""}
              placeholder="+49…"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-ink-soft/75">{f("whatsappNumberHint")}</p>
          </div>

          <button
            type="submit"
            className="mt-2 rounded-md bg-brass px-5 py-2.5 text-sm font-semibold text-paper transition-[transform,box-shadow] hover:-translate-y-px hover:bg-brass-deep"
          >
            {t("save")}
          </button>
        </form>
      </div>
    </main>
  );
}
