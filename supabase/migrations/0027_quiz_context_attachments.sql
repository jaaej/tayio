-- 0027_quiz_context_attachments.sql - context question type, per-question
-- attachments, and nested question support. Additive and non-destructive.
--
-- A context block is a quiz_questions row with type='context' holding a passage
-- in prompt and no options. Its sub-questions are multiple_choice/true_false
-- rows whose parent_id points at the context block. Every row still carries
-- quiz_id, so the RLS policies from 0025/0026 (all keyed on quiz_id) already
-- cover nested rows; no new policies are required.
--
-- Postgres note: a new enum value cannot be used in the same transaction that
-- adds it. This migration only alters schema and never inserts a row using
-- 'context', so wrapping in begin/commit is safe.
--
-- Reversible by:
--   ALTER TABLE public.quiz_attachments DROP COLUMN question_id;
--   ALTER TABLE public.quiz_questions DROP COLUMN parent_id;
--   (the enum value cannot be dropped; harmless).

begin;

alter type quiz_question_type add value if not exists 'context';

alter table public.quiz_questions
  add column if not exists parent_id uuid
  references public.quiz_questions(id) on delete cascade;

create index if not exists quiz_questions_parent_idx
  on public.quiz_questions(parent_id);

alter table public.quiz_attachments
  add column if not exists question_id uuid
  references public.quiz_questions(id) on delete cascade;

create index if not exists quiz_attachments_question_idx
  on public.quiz_attachments(question_id);

commit;
