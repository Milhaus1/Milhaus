-- supabase/migrations/20261125170000_add_business_event_location.sql
-- Map positions for businesses and events, the same as homes got in
-- 20261125150000_add_listing_location.sql — so the Services and Events
-- pages can show everything within 30 or 50 km of a base too (Terry's
-- ask, 2026-11-25: "Can this be added to all of the pages that needs it
-- like cars?"). Cars use the listings columns already added.
--
-- Filled in by the site from the town (src/lib/geocode.ts) after each
-- save, with the daily cron job catching up. Null until then — the
-- filters fall back to the base it was listed under.
--
-- Safe to run more than once.

alter table public.businesses
  add column if not exists latitude double precision check (latitude between -90 and 90),
  add column if not exists longitude double precision check (longitude between -180 and 180),
  add column if not exists located_at timestamptz;

alter table public.events
  add column if not exists latitude double precision check (latitude between -90 and 90),
  add column if not exists longitude double precision check (longitude between -180 and 180),
  add column if not exists located_at timestamptz;
