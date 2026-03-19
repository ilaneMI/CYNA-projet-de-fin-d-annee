-- Lot B sub-step 1.bis — Lock down the anon role on public.profiles.
--
-- Defense in depth, not a functional change. The previous auth_profiles
-- migration leaves RLS as the only barrier between anon and profiles:
-- no policy is declared `to anon`, so RLS already denies every read or
-- write anon could attempt. But Supabase's default `GRANT ALL ... TO
-- anon` on new public schema tables still surfaces in
-- information_schema.column_privileges as broad anon access, which is
-- misleading in an audit and becomes a real exposure if RLS is ever
-- weakened (e.g. a temporary `alter table … disable row level
-- security` during debugging, or a policy mistake added later).
--
-- Revoking everything from anon makes the SQL grant layer agree with
-- the RLS intent: anon has no business reading or writing profiles,
-- and the system catalog now says so. service_role is untouched and
-- keeps its BYPASSRLS-backed access for admin tooling.

revoke all on public.profiles from anon;
