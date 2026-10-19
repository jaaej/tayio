-- 0076: keep a family's reason for a credit on the credit.
--
-- A family's reason for moving or cancelling a lesson used to be copied into
-- the staff roll note ("Rescheduled: <reason>"). Moves keep it on the
-- reschedule request and cancellations on lesson_cancellations; a credit a
-- family asks for when no reschedule slot is free had nowhere else, so it gets
-- request_reason. The roll shows each reason from its source (getLessonRoll).
--
-- Additive: one nullable column with a length check that every row meets.
-- Reversible: drop the column.

alter table public.class_credits
  add column if not exists request_reason text;
alter table public.class_credits
  drop constraint if exists class_credits_request_reason_check;
alter table public.class_credits
  add constraint class_credits_request_reason_check
  check (request_reason is null or char_length(request_reason) <= 2000);
