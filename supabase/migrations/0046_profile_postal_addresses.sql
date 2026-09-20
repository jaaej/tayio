-- 0046_profile_postal_addresses.sql - structured postal contact details for
-- every portal account. Existing accounts remain valid and can be completed
-- by admin later; the create-user form collects the complete address for new
-- accounts.
--
-- Additive and non-destructive. Address fields inherit the profiles table's
-- existing RLS policies and are never exposed through a new client policy.
--
-- Reversible by:
--   ALTER TABLE public.profiles
--     DROP COLUMN address_line_1,
--     DROP COLUMN address_line_2,
--     DROP COLUMN suburb,
--     DROP COLUMN state,
--     DROP COLUMN postcode;

begin;

alter table public.profiles
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists suburb text,
  add column if not exists state text,
  add column if not exists postcode text;

commit;
