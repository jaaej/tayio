-- 0078: one spelling for a student's year level.
--
-- Year level was free text, so accounts hold "10", "Year10", "Yr 10" and so
-- on. Admin now picks it from a list ("Prep", "Year 1" to "Year 12",
-- src/lib/year-level.ts), and moving every student up a year at the end of
-- the school year needs a level it can read. This rewrites each student's
-- value that names a school year to the list's spelling; anything else
-- ("VCE", which spans two years, or a typo) is left as it is and shows in
-- the picker until an admin chooses a level.
--
-- Only the spelling changes ("10" becomes "Year 10"); the year is the same,
-- and every screen already showed a bare number as "Year 10".
-- Not reversible to the old spellings, which carry no meaning.

with parsed as (
  select
    id,
    case
      when year_level ~* '^\s*(prep|foundation|f)\s*$' then 0
      else (regexp_match(year_level, '^\s*(?:(?:year|yr|y|grade|gr)\.?\s*)?(\d{1,2})\s*$', 'i'))[1]::int
    end as year
  from public.profiles
  where role::text like 'student%'
    and year_level is not null
)
update public.profiles p
set year_level = case when parsed.year = 0 then 'Prep' else 'Year ' || parsed.year end,
    updated_at = now()
from parsed
where p.id = parsed.id
  and parsed.year between 0 and 12
  and p.year_level is distinct from case when parsed.year = 0 then 'Prep' else 'Year ' || parsed.year end;
