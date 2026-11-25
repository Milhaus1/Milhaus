// src/lib/geocode.ts
// Puts homes, cars, businesses and events on the map: looks up the
// address (or town) on OpenStreetMap (Nominatim) and saves the latitude/
// longitude, for every page's "within 30 / 50 km of a base" filter
// (Terry's asks, 2026-11-25; see 20261125150000_add_listing_location.sql
// and 20261125170000_add_business_event_location.sql).
//
// Why OpenStreetMap: free, no account or key to hand over to Charlie, and
// a home's street and town are already public on its listing page. Its
// rules for a site like this: at most one lookup a second and a name the
// requests can be recognised by (USER_AGENT) — fine for one lookup per
// posted or edited item, plus the daily job's catch-up (it waits between
// lookups). Searches near the poster's chosen base first (see
// BASE_BOX_DEGREES). If the service is down or can't find the address,
// the item just keeps no position and the filter uses the base it was
// listed under instead; nothing is blocked.
//
// Server only — it uses the service-role client.

import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { BASE_COORDINATES, type BaseName } from "@/lib/bases";
import { createAdminClient } from "@/lib/supabase/admin";

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
  // "Stuttgart / Sindelfingen" (an event in two towns) isn't a place
  // OpenStreetMap knows — try the first town on its own.
  const firstTown = city.split(/[/,]/)[0].trim();
  if (firstTown && firstTown !== city.trim()) {
    if (box) attempts.push({ city: firstTown, ...box });
    attempts.push({ city: firstTown });
  }

  for (const params of attempts) {
    const found = await lookUp(params);
    // A street result must be in the right town; a town result is the town.
    if (found && (!params.street || inTown(found, city))) return found.point;
  }
  return null;
}

/** The tables that have a map position (2026-11-25): listings (homes
 * and cars), businesses and events. */
export type PlaceTable = "listings" | "businesses" | "events";

/** Look up one home, car, business or event and save where it is (or
 * that it couldn't be found). Homes are looked up by street and town;
 * everything else by town — that's all they have, and plenty for 30–50
 * km. `admin` is the service-role client — the caller has already
 * checked who's allowed to trigger this. */
export async function locatePlace(admin: SupabaseClient, table: PlaceTable, id: string): Promise<void> {
  const columns = table === "listings" ? "city, base, bases, rental_details(address)" : "city, base";
  const { data } = await admin.from(table).select(columns).eq("id", id).maybeSingle();
  if (!data) return;
  const row = data as unknown as {
    city: string | null;
    base: string | null;
    bases?: string[] | null;
    rental_details?: { address: string | null } | { address: string | null }[] | null;
  };

  const details = row.rental_details;
  const address = Array.isArray(details) ? (details[0]?.address ?? null) : (details?.address ?? null);
  // A dealer's car listed at several bases: search near the first.
  const base = row.base ?? row.bases?.[0] ?? null;
  const point = await locateAddress(address, row.city, base);

  await admin
    .from(table)
    .update({ latitude: point?.[0] ?? null, longitude: point?.[1] ?? null, located_at: new Date().toISOString() })
    .eq("id", id);
}

/** For server actions that have just saved a business or event: look it
 * up after the response has gone out (Next.js `after`), so nobody waits
 * for OpenStreetMap. The caller has already checked who may save it. */
export function locateLater(table: PlaceTable, id: string): void {
  after(() => locatePlace(createAdminClient(), table, id));
}
