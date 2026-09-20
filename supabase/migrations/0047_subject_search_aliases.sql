-- 0047_subject_search_aliases.sql - owner-managed quick keys for subject
-- searches in the admin user directory (for example, "e1/2").
--
-- The aliases are server-managed and deny-by-default to browser clients.

begin;

create table if not exists public.subject_search_aliases (
  subject_id uuid primary key
    references public.subjects(id) on delete cascade,
  alias text not null,
  updated_by_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint subject_search_aliases_value_check
    check (
      char_length(alias) between 1 and 24
      and alias = lower(alias)
      and alias ~ '^[a-z0-9][a-z0-9/+&._-]*$'
    )
);

create unique index if not exists subject_search_aliases_lower_unique_idx
  on public.subject_search_aliases(lower(alias));

alter table public.subject_search_aliases enable row level security;

commit;
