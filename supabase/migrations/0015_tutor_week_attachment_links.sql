-- 0015_tutor_week_attachment_links.sql
-- Allow tutor week attachments to represent external links (video / resource
-- URLs) in addition to uploaded files. Additive & non-destructive: existing
-- rows default to kind='file' and keep their storage_path. Columns only —
-- RLS policies on tutor_week_attachments are unchanged.
--
-- Reversible by:
--   alter table public.tutor_week_attachments
--     drop constraint if exists tutor_week_attachments_kind_check;
--   -- (re-populate any null storage_path rows before re-adding NOT NULL)
--   alter table public.tutor_week_attachments alter column storage_path set not null;
--   alter table public.tutor_week_attachments drop column if exists url;
--   alter table public.tutor_week_attachments drop column if exists kind;

alter table public.tutor_week_attachments
  add column if not exists kind text not null default 'file',
  add column if not exists url text;

alter table public.tutor_week_attachments
  alter column storage_path drop not null;

alter table public.tutor_week_attachments
  drop constraint if exists tutor_week_attachments_kind_check;

alter table public.tutor_week_attachments
  add constraint tutor_week_attachments_kind_check
  check (
    (kind = 'file' and storage_path is not null) or
    (kind = 'link' and url is not null)
  );
