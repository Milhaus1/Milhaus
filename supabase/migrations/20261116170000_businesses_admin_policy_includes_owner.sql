-- supabase/migrations/20261116170000_businesses_admin_policy_includes_owner.sql
-- Let the 'owner' role (Charlie) manage businesses, not just 'admin'.
--
-- What broke (2026-11-16, the first time Charlie ran Admin → Businesses
-- himself after the handover): every button there — Mark consent
-- confirmed, Resend email, Hide, Feature, Delete — "did nothing". The
-- original policy from 20261008150000_add_businesses_directory.sql checked
-- `role = 'admin'` only. Charlie's account is 'owner', so Postgres quietly
-- matched 0 rows on every update/delete (RLS doesn't raise an error for
-- that), and the page just reloaded unchanged. It never showed up before
-- because Terry, who tested it, is 'admin'.
--
-- Every other table already uses public.is_admin(), which means admin OR
-- owner (20260823132745_profiles_role_as_enum.sql). This brings businesses
-- into line. Safe to re-run.

drop policy if exists "businesses: admins manage" on public.businesses;

create policy "businesses: admins manage"
  on public.businesses
  for all
  using (public.is_admin())
  with check (public.is_admin());
