// src/lib/bases.ts
// Shared list of bases/military communities — used by the browse page's
// filter chips, the hero search bar, and the post-a-listing form, so the
// three stay in sync. (Also the business, event and admin forms.)
// Adding a base here is all it takes: no database change is needed.
// Ansbach added 2026-11-16 (Charlie's ask). Baumholder and Vilseck added
// 2026-11-25 (Terry's ask) — Vilseck sits next to Grafenwöhr, both part of
// the Bavaria garrison, but families search for it by its own name.

export const BASE_NAMES = [
  "Stuttgart",
  "Kaiserslautern",
  "Ramstein",
  "Baumholder",
  "Wiesbaden",
  "Grafenwöhr",
  "Vilseck",
  "Spangdahlem",
  "Ansbach",
] as const;
