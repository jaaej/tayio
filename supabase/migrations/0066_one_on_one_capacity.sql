-- 0066: a one-on-one class has exactly one place.
--
-- Owner decision, 18 October 2026. Reschedules already treat a one-on-one
-- lesson as private (always approval), and make-ups and class moves count
-- free places from capacity, so capacity 1 makes those paths refuse a second
-- student too. The subject page refuses saving a one-on-one class with more
-- than one current student (an enrolment count cannot be a check constraint).
--
-- Existing data: a one-on-one class that already has more than one current
-- student becomes a group class (keeping its capacity), since its people are
-- real; every other one-on-one class gets capacity 1. Production had no
-- one-on-one classes when this was written.
--
-- Reversible: drop the constraint. Classes switched to group stay group.

begin;

update public.classes c
set class_type = 'group'
where c.class_type = 'one_on_one'
  and (
    select count(*) from public.enrollments e
    where e.class_id = c.id and e.withdrawn_at is null
  ) > 1;

update public.classes
set capacity = 1
where class_type = 'one_on_one' and capacity <> 1;

alter table public.classes
  drop constraint if exists classes_one_on_one_capacity;
alter table public.classes
  add constraint classes_one_on_one_capacity
  check (class_type <> 'one_on_one' or capacity = 1);

commit;
