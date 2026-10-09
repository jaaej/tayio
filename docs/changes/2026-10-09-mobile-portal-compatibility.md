# Mobile portal compatibility

Date: 9 October 2026

## Outcome

The admin, tutor, student, and parent portals now use one compact expandable navigation menu on phone-width screens.

Their existing desktop sidebars and desktop content dimensions remain unchanged through responsive breakpoints.

Curriculum pages keep the weeks rail collapsed on phones until the user chooses to open it.

Seven-day calendars and operational tables now scroll inside their own bounded regions instead of compressing content or widening the whole page.

Shared heroes, page headers, action groups, the permanent class-time footer, side panels, and homework viewers use phone-appropriate spacing and widths.

PDF, image, and video viewers use the available phone viewport while preserving the existing desktop modal treatment.

## Design decisions

The mobile menu shows the active destination in its closed state so users retain page context without a permanently visible navigation row.

Dense tables and seven-column calendars retain their information structure and use local horizontal scrolling because collapsing or hiding columns would remove operational context.

Desktop behavior is preserved with `sm` and `lg` breakpoint overrides rather than changing the base desktop component structure.

## Verification

`npm run typecheck` passed.

All 177 automated tests passed across 32 files.

The Next.js production build completed successfully and generated all 51 static pages.

Authenticated phone and desktop browser acceptance remains listed in `checklist_beta_fix.md`.
