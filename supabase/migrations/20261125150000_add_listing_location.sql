-- supabase/migrations/20261125150000_add_listing_location.sql
-- Where a home is on the map, so the Homes page's Base filter can show
-- every home within 30 or 50 km of a base instead of only the ones whose
-- lister picked that base (Terry's ask, 2026-11-25: "the filtering of
-- homes needs to include a 30-50km radius from each base").
--
-- Filled in by the site, not the lister: after a home is posted or edited
-- its address is looked up on OpenStreetMap (src/lib/geocode.ts), and the
-- daily cron job fills in any it missed. Null until then — the filter
-- falls back to the lister's own "nearest base" for those.
--
-- Safe to run more than once.

alter table public.listings
  add column if not exists latitude double precision check (latitude between -90 and 90),
  add column if not exists longitude double precision check (longitude between -180 and 180),
  -- When the address was last looked up (found or not), so the daily job
  -- doesn't keep retrying an address OpenStreetMap can't find.
  add column if not exists located_at timestamptz;
