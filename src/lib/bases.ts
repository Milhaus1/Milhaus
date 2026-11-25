// src/lib/bases.ts
// Shared list of bases/military communities — used by the browse page's
// filter chips, the hero search bar, and the post-a-listing form, so the
// three stay in sync. (Also the business, event and admin forms.)
// Adding a base here is all it takes: no database change is needed —
// just add its name below and its position to BASE_COORDINATES.
// Ansbach added 2026-11-16 (Charlie's ask). Baumholder and Vilseck added
// 2026-11-25 (Terry's ask), then the same day Landstuhl, Vogelweh, Sembach,
// Geilenkirchen, Hohenfels and Garmisch ("go ahead and list all of them").
// Landstuhl, Vogelweh and Sembach are really part of the Kaiserslautern
// area, but families search for them by name. Listed by area, not A–Z, so
// neighbours sit together in every list.

export const BASE_NAMES = [
  "Stuttgart",
  "Kaiserslautern",
  "Ramstein",
  "Landstuhl",
  "Vogelweh",
  "Sembach",
  "Baumholder",
  "Spangdahlem",
  "Wiesbaden",
  "Geilenkirchen",
  "Grafenwöhr",
  "Vilseck",
  "Hohenfels",
  "Ansbach",
  "Garmisch",
] as const;

export type BaseName = (typeof BASE_NAMES)[number];

/** Where each base is (latitude, longitude), for the Homes page's
 * "within 30 / 50 km" filter (Terry's ask, 2026-11-25). Looked up on
 * OpenStreetMap the same day — the installation itself where there is
 * one (Patch Barracks for Stuttgart, Clay Kaserne for Wiesbaden, Camp
 * Albertshof for Hohenfels…), the city centre for Kaiserslautern. A
 * kilometre or two either way makes no difference at 30–50 km. */
export const BASE_COORDINATES: Record<BaseName, [number, number]> = {
  Stuttgart: [48.7355, 9.0809],
  Kaiserslautern: [49.4432, 7.769],
  Ramstein: [49.4414, 7.6012],
  Landstuhl: [49.4042, 7.5603],
  Vogelweh: [49.4318, 7.7143],
  Sembach: [49.5321, 7.8659],
  Baumholder: [49.6281, 7.3272],
  Spangdahlem: [49.9796, 6.6996],
  Wiesbaden: [50.0433, 8.3246],
  Geilenkirchen: [50.9555, 6.0562],
  Grafenwöhr: [49.7113, 11.9003],
  Vilseck: [49.6354, 11.7907],
  Hohenfels: [49.2335, 11.8191],
  Ansbach: [49.3124, 10.6412],
  Garmisch: [47.4842, 11.0592],
};

/** The distances the Homes page offers ("within 30 km" / "within 50 km"). */
export const RADIUS_OPTIONS_KM = [30, 50] as const;
export const DEFAULT_RADIUS_KM = 50;

/** Straight-line distance in km between two points (haversine). Roads
 * are longer, but this is for "roughly how close", not directions. */
export function distanceKm([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Anything the base filters can place: a home, car, business or event.
 * `bases` is a car dealer's list of several bases, when it has one. */
export type Placeable = {
  base: string | null;
  bases?: string[] | null;
  latitude: number | null;
  longitude: number | null;
};

/** How far something is from a base, or null when it hasn't been placed
 * on the map yet (or the base has no position). */
export function kmFromBase(item: Placeable, base: string): number | null {
  const point = BASE_COORDINATES[base as BaseName];
  if (!point || item.latitude == null || item.longitude == null) return null;
  return distanceKm([item.latitude, item.longitude], point);
}

/** Does something belong under this base? Yes if it's within the radius,
 * or if its poster listed it under this base — their own choice never
 * hides it from that base (a dealer serving several bases, a home that
 * hasn't been placed on the map yet). Every page's Base filter uses this
 * since 2026-11-25 (Homes first, then Cars, Services and Events). */
export function isNearBase(item: Placeable, base: string, radiusKm: number): boolean {
  if (item.base === base || item.bases?.includes(base)) return true;
  const km = kmFromBase(item, base);
  return km !== null && km <= radiusKm;
}

/** Distance to the closest of the picked bases, for "nearest first";
 * Infinity when it can't be measured, so those sort last. */
export function nearestKm(item: Placeable, bases: string[]): number {
  const distances = bases.map((base) => kmFromBase(item, base)).filter((km): km is number => km !== null);
  return distances.length > 0 ? Math.min(...distances) : Number.POSITIVE_INFINITY;
}
