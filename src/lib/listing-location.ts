// src/lib/listing-location.ts
// The server action the home form calls right after a home is posted or
// edited, so it's placed on the map for the "within 30 / 50 km of a base"
// filter straight away (2026-11-25 — the lookup itself is in
// src/lib/geocode.ts). The form doesn't wait for it: the lister sees
// "You're live!" at once, and if this ever fails the daily cron job
// catches the home up.
//
// Only the home's own lister or an admin may trigger it; the write uses
// the service-role client after that check.

"use server";

import { locateListing } from "@/lib/geocode";
import { isAdminRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function updateListingLocation(listingId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const [{ data: listing }, { data: profile }] = await Promise.all([
    admin.from("listings").select("owner_id").eq("id", listingId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!listing) return;
  if (listing.owner_id !== user.id && !isAdminRole(profile?.role)) return;

  await locateListing(admin, listingId);
}
