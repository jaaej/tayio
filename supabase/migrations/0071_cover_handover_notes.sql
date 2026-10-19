-- 0071: a handover note for the covering tutor, apart from the private reason.
--
-- A tutor's reason for time away (for example a medical one) was copied into
-- every cover request and printed on the Cover board for every tutor. The
-- reason now stays with the tutor and admins; the board shows only this
-- optional note, written for whoever covers the class. Leave keeps its note
-- on the leave request and the board reads it through leave_request_id, so
-- an edit or withdrawal never leaves stale copies on the cover requests.
--
-- Additive: two nullable columns. Both tables stay server-only (RLS on, no
-- policies, migration 0043).
--
-- Reversible: drop the two columns.

begin;

alter table public.tutor_leave_requests
  add column if not exists handover_note text;
alter table public.tutor_leave_requests
  drop constraint if exists tutor_leave_requests_handover_note_check;
alter table public.tutor_leave_requests
  add constraint tutor_leave_requests_handover_note_check
  check (handover_note is null or char_length(handover_note) between 1 and 2000);

alter table public.tutor_cover_requests
  add column if not exists handover_note text;
alter table public.tutor_cover_requests
  drop constraint if exists tutor_cover_requests_handover_note_check;
alter table public.tutor_cover_requests
  add constraint tutor_cover_requests_handover_note_check
  check (handover_note is null or char_length(handover_note) between 1 and 2000);

commit;
