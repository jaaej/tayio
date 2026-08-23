-- 0042_revert_profile_sync_on_metadata_update.sql - drop the trigger added in
-- 0041. It fixed a problem the application does not have, and broke the one
-- path that matters.
--
-- What 0041 assumed: that a missing public.profiles row after
-- `auth.admin.createUser({ app_metadata: { role } })` meant the app could not
-- create users. That observation was real - GoTrue does write app_metadata in a
-- statement after the auth.users insert, so 0001's AFTER INSERT trigger
-- resolves a null role and skips - but the conclusion was wrong.
--
-- `createUser` in src/app/admin/_lib/actions-users.ts does not rely on the
-- trigger at all: it inserts the profiles row itself, right after the auth user
-- is created, because it also needs to persist phone / year_level / school,
-- which the trigger knows nothing about. The rows only appeared to be missing
-- because the accounts in question were created by a one-off script that
-- skipped that insert.
--
-- With 0041 in place the trigger wins the race, and the app's own insert then
-- fails on the primary key. Its catch block deletes the auth user and surfaces
-- "Failed query: insert into profiles ...", so creating a tutor fails outright.
--
-- Reverting rather than making the app's insert an upsert: the app is the only
-- supported way to create an account (sign-up is disabled, B11), so a second
-- writer for the same row is machinery with no caller. 0001's INSERT trigger
-- stays as-is - harmless, and still the right thing if a role ever does arrive
-- in the same statement as the insert.
--
-- Reversible by: re-applying 0041.

begin;

drop trigger if exists on_auth_user_metadata_set on auth.users;

commit;
