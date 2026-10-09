# Inline homework viewing and quiz editing

Date: 8 October 2026

## Outcome

Homework attachments and solutions now use a shared viewer instead of requiring a download.

PDFs, images, and browser-supported videos open in a modal inside the portal.

Office documents and other unsupported browser formats keep an Open file fallback.

The same viewer is available from student homework, tutor homework and marking, and admin curriculum homework.

Admin curriculum now labels the existing quiz action `Edit quiz` for every quiz status.

Admins can edit approved quizzes without first changing their published status.

Tutor editing remains limited to requested or changes-requested quizzes so the existing review workflow is preserved.

## Security and compatibility

Private files continue to use short-lived signed Supabase Storage URLs.

The content security policy now permits the configured Supabase origin in frames so signed PDFs can render in the portal viewer.

The viewer does not make private objects public or store signed URLs in the database.

## Verification

`npm run typecheck` passed.

`npm test` passed with 177 tests across 32 files.

An authenticated cross-role browser check remains listed in `checklist_beta_fix.md`.
