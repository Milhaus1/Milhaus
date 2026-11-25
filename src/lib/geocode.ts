// src/lib/geocode.ts
// Puts a home on the map: looks up its address on OpenStreetMap
// (Nominatim) and saves the latitude/longitude on the listing, for the
// Homes page's "within 30 / 50 km of a base" filter (Terry's ask,
// 2026-11-25; see 20261125150000_add_listing_location.sql).
//
// Why OpenStreetMap: free, no account or key to hand over to Charlie, and
// a home's street and town are already public on its listing page. Its
// rules for a site like this: at most one lookup a second and a name the
// requests can be recognised by (USER_AGENT) — fine for one lookup per
// posted or edited home, plus the daily job's catch-up (it waits between
// lookups). Searches near the lister's chosen base first (see
// BASE_BOX_DEGREES). If the service is down or can't find the address, the home
// just keeps no position and the filter uses the lister's own "nearest
// base" instead; nothing is blocked.
//
// Server only — it uses the service-role client.

import type { SupabaseClient } from "@supabase/supabase-js";
import { BASE_COORDINATES, type BaseName } from "@/lib/bases";

const USER_AGENT = "Milhaus/1.0 (+https://www.milhaus.de)";

// How far around the lister's chosen base to search first (degrees; ~0.8
// is 55–90 km). Many German towns share names — "Eschenbach" alone found
// one near Ansbach for a home near Grafenwöhr — so the area the lister
// already told us about is searched before the whole country.
const BASE_BOX_DEGREES = 0.8;

type Found = { point: [number, number]; places: string[] };

async function lookUp(params: Record<string, string>): Promise<Found | null> {
  const query = new URLSearchParams({ ...params, format: "jsonv2", limit: "1", countrycodes: "de", addressdetails: "1" });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const results = (await response.json()) as { lat: string; lon: string; address?: Record<string, string> }[];
    const first = results[0];
    if (!first) return null;
    const point: [number, number] = [Number(first.lat), Number(first.lon)];
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
    const a = first.address ?? {};
    return { point, places: [a.city, a.town, a.village, a.municipality, a.suburb].filter(Boolean) as string[] };
  } catch {
    return null;
  } finally {
    // Nominatim allows one lookup a second.
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
}

/** Is the found address really in the home's town? A street search can
 * land on the same street name in a neighbouring village ("Bahnhofstraße
 * 41, Kaiserslautern" found one in Bruchmühlbach-Miesau). Compares the
 * first word: "Wiesbaden Erbenheim" matches Wiesbaden, "Ramstein-Miesenbach"
 * matches itself. */
function inTown(found: Found, city: string): boolean {
  const word = (text: string) => text.toLowerCase().split(/[\s,/-]+/)[0];
  const wanted = word(city);
  return found.places.some((place) => word(place) === wanted);
}

/** Where a home is: its street in its town, searched near its base first;
 * failing that, the town itself (plenty for 30–50 km). Null if neither is
 * found. */
export async function locateAddress(
  address: string | null,
  city: string | null,
  base: string | null,
): Promise<[number, number] | null> {
  if (!city) return null;
  const near = base ? BASE_COORDINATES[base as BaseName] : undefined;
  const box = near
    ? {
        viewbox: [near[1] - BASE_BOX_DEGREES, near[0] + BASE_BOX_DEGREES, near[1] + BASE_BOX_DEGREES, near[0] - BASE_BOX_DEGREES].join(","),
        bounded: "1",
      }
    : null;

  const attempts: Record<string, string>[] = [];
  if (address && box) attempts.push({ street: address, city, ...box });
  if (box) attempts.push({ city, ...box });
  if (address) attempts.push({ street: address, city });
  attempts.push({ city });

  for (const params of attempts) {
    const found = await lookUp(params);
    // A street result must be in the right town; a town result is the town.
    if (found && (!params.street || inTown(found, city))) return found.point;
  }
  return null;
}

/** Look up one home and save where it is (or that it couldn't be found).
 * `admin` is the service-role client — the caller has already checked
 * who's allowed to trigger this. Homes only: cars and services aren't
 * filtered by distance. */
export async function locateListing(admin: SupabaseClient, listingId: string): Promise<void> {
  const { data: listing } = await admin
    .from("listings")
    .select("type, city, base, rental_details(address)")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.type !== "rental") return;

  const details = listing.rental_details as { address: string | null } | { address: string | null }[] | null;
  const address = Array.isArray(details) ? (details[0]?.address ?? null) : (details?.address ?? null);
  const point = await locateAddress(address, listing.city as string | null, listing.base as string | null);

  await admin
    .from("listings")
    .update({ latitude: point?.[0] ?? null, longitude: point?.[1] ?? null, located_at: new Date().toISOString() })
    .eq("id", listingId);
}
