-- supabase/migrations/20261125120000_add_temporary_living.sql
-- Temporary living: furnished short stays for families arriving or
-- leaving on PCS (the kind of place a family stays in while on TLA).
-- Charlie's ask, 2026-11-25: a temporary-living company in Ramstein
-- wants to list a lot of properties, and Terry: "there are many many many
-- TLAs around all of the bases, please build it with that in mind".
--
-- Built the same way as homes for sale (20261104120000_add_homes_for_sale.sql):
-- still a type='rental' listing, sharing every home feature, with
-- offer_type='temporary'. The Homes page gets a third tab, and it has its
-- own posting price in Admin → Pricing. price_eur_month holds the price
-- PER NIGHT for these, the same way it holds a sale's asking price.
--
-- Never call these "TLA approved" or similar on the site: TLA is paid
-- through the military's own offices, and nothing may suggest they approve
-- or endorse a listing (CLAUDE.md, rule 1).
--
-- Safe to run more than once.

-- 1. The third kind of home.
alter table public.listings drop constraint if exists listings_offer_type_check;
alter table public.listings add constraint listings_offer_type_check
  check (offer_type in ('rent', 'sale', 'temporary'));

-- 2. What short-stay guests filter by: how many people it sleeps, and the
-- shortest stay the company accepts. Both null on ordinary homes.
alter table public.rental_details
  add column if not exists max_guests integer check (max_guests between 1 and 30),
  add column if not exists min_nights integer check (min_nights between 1 and 365);

-- 3. Its own posting price, starting free like every other category.
alter table public.listing_prices drop constraint if exists listing_prices_type_check;
alter table public.listing_prices add constraint listing_prices_type_check
  check (type in ('rental', 'rental_sale', 'rental_temporary', 'car', 'product', 'service', 'business'));
insert into public.listing_prices (type, price_eur) values ('rental_temporary', 0)
on conflict do nothing;
