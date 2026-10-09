# Message drafts, tutor photos, and subject-only homework

**Date:** 8 October 2026

## Outcome

Opening a direct-message composer no longer adds an empty conversation to the
shared inbox.
The canonical thread row may still be created for routing and pair uniqueness,
but `listMyThreads` requires a first message before returning it to any role.
Existing empty thread rows are hidden without deleting message history.

Tutors can upload, replace, and remove a profile photo at `/tutor/profile`.
The photo is validated as JPEG, PNG, or WebP up to 5 MB, stored in the private
`profile-photos` bucket, and rendered through short-lived signed URLs.
The existing controlled icon and initials remain the fallback.

Admins can save homework against a curriculum week without selecting a class.
This subject-only homework has no marking tutor and creates no student
assignments.
Selecting a class continues to assign active students and retain the class
tutor as the marking owner.

## Data changes

Migration `0057_subject_homework_drafts.sql` makes
`homework.tutor_id` nullable for subject-only curriculum material.
Migration `0058_tutor_profile_photos.sql` creates the private
`profile-photos` bucket with a 5 MB JPEG/PNG/WebP allowlist.

Both migrations were applied to the isolated development database on
8 October 2026.
Production application and smoke testing remain required.

## Verification

- Reproduced the empty-thread inbox bug in the authenticated admin portal
  before changing the shared query.
- Confirmed the development database has 15 canonical thread rows and only
  four with messages; the updated inbox query returns only message-bearing
  threads.
- Confirmed the development `profile-photos` bucket is private with the 5 MB
  JPEG/PNG/WebP restrictions.
- TypeScript validation passed.
- All 173 tests passed across 31 test files.
- The Next.js production build completed successfully.
- Development RLS verification passed for all 56 public tables.
- Authenticated tutor photo upload and cross-role browser acceptance remain in
  `checklist_beta_fix.md`.
