-- 0085: writing on files in the portal's viewer.
--
-- Students can draw, highlight and type on a worksheet, booklet or library
-- file, and hand a homework worksheet in with their writing on it ("Submit
-- this file"); tutors can do the same on a student's submitted file as
-- feedback. The marks are stored here, apart from the files, as JSON in page
-- units (src/lib/markup/doc.ts):
--   layer 'notes'    owner_id = the student; private to them.
--   layer 'feedback' owner_id = the student whose submission it is; written by
--                    the homework's tutor, seen by the student and their
--                    parents once the work is marked.
-- file_version is the storage object's version, so a file replaced at the same
-- path opens without marks made on the old one (those rows stay). version
-- counts saves so a stale save is refused instead of overwriting a newer one.
--
-- RLS: enabled with no client policies; only the server's connection reads
-- and writes it, after its own role checks (src/lib/markup/targets.ts).
-- Additive. Reversible: drop table public.file_markups; drop type public.markup_layer.

do $$
begin
  create type public.markup_layer as enum ('notes', 'feedback');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.file_markups (
  id uuid primary key default gen_random_uuid(),
  layer public.markup_layer not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  file_bucket text not null,
  file_path text not null,
  file_version text not null default '',
  data jsonb not null,
  version integer not null default 1,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint file_markups_data_size check (pg_column_size(data) <= 3000000)
);

create unique index if not exists file_markups_unique
  on public.file_markups (layer, owner_id, file_bucket, file_path, file_version);
create index if not exists file_markups_file_idx
  on public.file_markups (file_bucket, file_path);

alter table public.file_markups enable row level security;
