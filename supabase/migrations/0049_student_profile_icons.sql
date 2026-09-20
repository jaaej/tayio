-- 0049_student_profile_icons.sql - controlled, code-rendered student avatars.

begin;

alter table public.profiles
  add column if not exists profile_avatar_key text;

do $$ begin
  alter table public.profiles
    add constraint profiles_profile_avatar_key_allowed check (
      profile_avatar_key is null or profile_avatar_key in (
        'sparkles', 'star', 'rocket', 'brain', 'book', 'calculator',
        'palette', 'cat', 'dog', 'rabbit', 'bird', 'fish'
      )
    );
exception when duplicate_object then null; end $$;

commit;
