-- 0048_announcement_targeting_and_approval.sql - recipient snapshots,
-- combinable audience rules, tutor approval, and auditable urgent-email jobs.
--
-- Existing announcements remain published and are backfilled to the people who
-- currently match their legacy everyone/role/class audience.

begin;

do $$ begin
  create type public.announcement_status as enum
    ('pending', 'published', 'rejected');
exception when duplicate_object then null; end $$;

alter table public.announcements
  add column if not exists status public.announcement_status
    not null default 'published',
  add column if not exists is_urgent boolean not null default false,
  add column if not exists target_roles jsonb not null default '[]'::jsonb,
  add column if not exists target_subject_ids jsonb not null default '[]'::jsonb,
  add column if not exists target_year_levels jsonb not null default '[]'::jsonb,
  add column if not exists target_class_ids jsonb not null default '[]'::jsonb,
  add column if not exists target_tutor_ids jsonb not null default '[]'::jsonb,
  add column if not exists include_linked_parents boolean not null default false,
  add column if not exists approved_by_id uuid
    references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_reason text;

create table if not exists public.announcement_recipients (
  announcement_id uuid not null
    references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists announcement_recipients_user_idx
  on public.announcement_recipients(user_id, created_at desc);

create table if not exists public.announcement_email_deliveries (
  announcement_id uuid not null
    references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  last_error text,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists announcement_email_pending_idx
  on public.announcement_email_deliveries(status, attempts, updated_at);

-- Legacy everyone announcements.
insert into public.announcement_recipients (announcement_id, user_id)
select a.id, p.id
from public.announcements a
cross join public.profiles p
where a.audience_role is null
  and a.audience_class_id is null
  and p.is_active = true
on conflict do nothing;

-- Legacy role announcements. Coarse and tiered values are both supported.
insert into public.announcement_recipients (announcement_id, user_id)
select a.id, p.id
from public.announcements a
join public.profiles p on p.is_active = true
where a.audience_role is not null
  and a.audience_class_id is null
  and (
    p.role = a.audience_role
    or (a.audience_role = 'student' and p.role in
      ('student', 'student_restricted', 'student_unrestricted'))
    or (a.audience_role = 'admin' and p.role in
      ('admin', 'admin_restricted', 'admin_unrestricted'))
  )
on conflict do nothing;

-- Legacy class announcements: enrolled students, their linked parents, and
-- the assigned class tutor all retain access.
insert into public.announcement_recipients (announcement_id, user_id)
select distinct a.id, recipient.user_id
from public.announcements a
join lateral (
  select e.student_id as user_id
  from public.enrollments e
  where e.class_id = a.audience_class_id and e.withdrawn_at is null
  union
  select fl.parent_id
  from public.enrollments e
  join public.family_links fl on fl.student_id = e.student_id
  where e.class_id = a.audience_class_id and e.withdrawn_at is null
  union
  select c.tutor_id from public.classes c where c.id = a.audience_class_id
) recipient on true
where a.audience_class_id is not null
on conflict do nothing;

alter table public.announcement_recipients enable row level security;
alter table public.announcement_email_deliveries enable row level security;

-- Recipient membership is deliberately not directly queryable. This narrow
-- SECURITY DEFINER helper lets the announcement SELECT policy verify only the
-- current user's own membership without exposing the recipient list.
create or replace function public.is_announcement_recipient(
  requested_announcement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.announcement_recipients ar
    where ar.announcement_id = requested_announcement_id
      and ar.user_id = auth.uid()
  );
$$;

revoke all on function public.is_announcement_recipient(uuid) from public;
grant execute on function public.is_announcement_recipient(uuid)
  to authenticated;

drop policy if exists announcements_read_audience on public.announcements;
create policy announcements_read_audience on public.announcements
  for select to authenticated using (
    author_id = auth.uid()
    or (
      status = 'published'
      and public.is_announcement_recipient(id)
    )
  );

commit;
