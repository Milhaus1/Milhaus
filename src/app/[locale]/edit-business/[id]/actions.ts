// src/app/[locale]/edit-business/[id]/actions.ts
// Saving an edit to a Military-Friendly Businesses listing. Added
// 2026-11-17: Charlie listed The Used Car Guys Stuttgart and found he
// couldn't change it — businesses had never had an edit option, for the
// business itself or for him (homes and cars have /edit-listing/[id]).
//
// Who can save: the account that submitted the business (owner_id), or
// an admin/owner-role account (Charlie). The businesses table has no
// "owners update their own" policy, so after checking that here, the
// write goes through the service-role client — the same trusted-path
// pattern as src/lib/listing-edit.ts, and no SQL for Terry to run.
//
// What can't change here, because of the consent rule (a business is
// listed only with its own confirmed consent — CLAUDE.md rule 2):
//  - the business email: that's the address that confirmed consent. A
//    different email means listing it again, with a new confirmation.
//  - the business name, unless an admin is saving: otherwise a confirmed
//    listing could be renamed into a different business that never
//    agreed. (Proposed to Terry 2026-11-17 when he asked for Edit; if
//    businesses should rename themselves, drop the isAdmin check on name.)
// A live business stays live while it's edited (as homes and cars do).

"use server";

import { locateLater } from "@/lib/geocode";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { BUSINESS_CATEGORY_KEYS, BUSINESS_TAG_KEYS, type BusinessCategoryKey } from "@/lib/businesses";
import { isAdminRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function text(formData: FormData, key: string): string | null {
  const value = (formData.get(key) as string | null)?.trim();
  return value ? value : null;
}

export async function updateBusiness(formData: FormData) {
  const locale = await getLocale();
  const id = formData.get("id") as string;
  const back = `/edit-business/${id}`;
  const fail = (message: string): never =>
    redirect({ href: `${back}?error=${encodeURIComponent(message)}`, locale }) as never;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: `/sign-in?next=${back}`, locale });

  const admin = createAdminClient();
  const [{ data: business }, { data: profile }] = await Promise.all([
    admin.from("businesses").select("id, owner_id").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle(),
  ]);
  if (!business) return fail("That business no longer exists.");
  const isAdmin = isAdminRole(profile?.role);
  if (business.owner_id !== user!.id && !isAdmin) return fail("You can only edit your own business.");

  const category = formData.get("category") as string;
  if (!BUSINESS_CATEGORY_KEYS.includes(category as BusinessCategoryKey)) return fail("Choose a category.");
  const city = text(formData, "city");
  if (!city) return fail("The city is required.");
  const name = text(formData, "name");
  if (isAdmin && !name) return fail("The business name is required.");

  // A new file replaces the picture; "remove" clears it. Each upload gets
  // a fresh file name, because Supabase's CDN keeps serving the old image
  // at a reused path (same lesson as listing photos and ad images).
  async function image(field: "logo" | "coverImage", stem: "logo" | "cover"): Promise<string | null | undefined> {
    const file = formData.get(field) as File | null;
    if (file && file.size > 0) {
      if (!file.type.startsWith("image/")) return fail("Pictures must be image files (JPG, PNG…).");
      if (file.size > MAX_IMAGE_BYTES) return fail("Each picture can be up to 3 MB.");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${id}/${stem}-${Date.now()}.${ext}`;
      const { error } = await admin.storage.from("listing-photos").upload(path, file, { contentType: file.type });
      if (error) return fail(`The picture couldn't be uploaded: ${error.message}`);
      return admin.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
    }
    if (formData.get(`remove_${field}`) === "on") return null;
    return undefined; // unchanged
  }
  const logoUrl = await image("logo", "logo");
  const coverUrl = await image("coverImage", "cover");

  const { error } = await admin
    .from("businesses")
    .update({
      ...(isAdmin && name ? { name } : {}),
      category,
      city,
      base: text(formData, "base"),
      tags: BUSINESS_TAG_KEYS.filter((key) => formData.get(`tag_${key}`) === "on"),
      description: text(formData, "description"),
      promotion: text(formData, "promotion"),
      website_url: text(formData, "websiteUrl"),
      phone: text(formData, "phone"),
      instagram_url: text(formData, "instagramUrl"),
      facebook_url: text(formData, "facebookUrl"),
      whatsapp_number: text(formData, "whatsappNumber"),
      ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
      ...(coverUrl !== undefined ? { cover_image_url: coverUrl } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return fail(error.message);

  // The town may have changed — back on the map (2026-11-25).
  locateLater("businesses", id);
  revalidatePath("/", "layout");
  redirect({ href: `${back}?saved=1`, locale });
}
