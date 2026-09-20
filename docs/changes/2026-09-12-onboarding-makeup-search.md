# Onboarding, make-up attendance, and directory search

Implemented locally on 12 September 2026. This batch is intentionally not a
production deployment; migrations 0046 and 0047 currently exist only in the
isolated test database.

## Account onboarding

- Added structured postal fields to profiles and to primary/linked-parent
  account creation.
- Added the same fields to admin profile editing and the profile summary.
- After account/profile creation succeeds, Supabase sends a recovery-style
  password-setup email to each new account. The email contains no password and
  lands on `/auth/callback?next=/reset-password`.
- Email failure does not roll back valid accounts. Admin receives a visible
  per-account delivery warning and retains the one-time temporary password.
- Redirect origins come only from an explicit configured URL or safe deployment
  defaults, never an incoming Host header.

## Make-up attendance

- Approved make-up attendees now have the same attendance status and note
  controls as enrolled students in tutor and admin lesson views.
- Tutors can write full lesson notes for a make-up attendee, but server
  authorization is scoped to the exact owned lesson and approved reschedule.
- Admin attendance writes are also limited to enrolled or approved make-up
  students for that lesson.
- Admin lesson detail now displays tutor lesson notes, including a visible
  make-up-attendee marker.
- No target-class enrolment is created, so the make-up attendee remains
  lesson-specific and should not appear on later rolls.

## Admin directory shortcuts

- Added owner-managed, per-subject quick keys under Admin Settings.
- Quick keys are normalized to lowercase, unique, and matched exactly.
- Existing name, email, class-name, and full-subject searches remain active.
- The shortcut table has RLS enabled with no browser policies; all writes are
  server-side after owner authorization.

## Verification completed

- `npm run typecheck`
- `npm test` — 23 files, 143 tests
- `npm run build`
- Test database migrations 0046 and 0047
- RLS audit — all 51 public tables protected or intentionally deny-by-default

Manual QA remains listed in `checklist_beta_fix.md`.
