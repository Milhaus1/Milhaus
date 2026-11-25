// src/lib/listing-location.ts
// The server action the listing form calls right after a home or car is
// posted or edited, so it's placed on the map for the "within 30 / 50 km
// of a base" filters straight away (2026-11-25 — the lookup itself is in
// src/lib/geocode.ts). The lookup runs after the action has answered
// (Next.js `after`), so neither the lister nor the form's next step waits
// for it; if it ever fails, the daily cron job catches the listing up.
//
// Only the listing's own poster or an admin may trigger it; the write
// uses the service-role client after that check.

"use server";

import { after } from "next/server";
import { locatePlace } from "@/lib/geocode";
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

  after(() => locatePlace(admin, "listings", listingId));
}
