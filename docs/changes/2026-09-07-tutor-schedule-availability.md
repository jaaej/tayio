# Tutor schedule and availability redesign

Date: 2026-09-07

## Interface

- `/tutor/timetable` is now the tutor's single scheduling hub.
- Recurring availability uses a labelled weekday, start time, and finish time.
  Saved windows are shown in full (for example, `Monday 3:00 PM–6:00 PM`) with
  a clearly labelled Remove action.
- One-date changes explicitly offer either `Unavailable all day` or
  `Use different hours`. Upcoming exceptions can be restored to weekly hours.
- The internal day-isolation sentinel remains compatible with availability
  expansion, but its dot/box control and the term "isolated" are no longer
  exposed to tutors.
- Assigned-class absence and extended-leave request forms now live on the same
  page. The cover board remains separate because taking another tutor's shift
  is a different task.
- Calendar cells display written `Unavailable` or `Changed` badges. The month
  grid scrolls horizontally on narrow screens instead of crushing controls.

## Performance

- `getCurrentUser()` is request-memoized, removing repeated Supabase auth calls
  made by nested layouts, shells, and pages during one render.
- The message inbox and its always-visible unread badge now use single SQL
  queries. They previously made three additional queries per thread; the badge
  paid that cost on every portal page.
- Message and notification badge counts load concurrently, and notification
  counts use SQL aggregation rather than transferring every unread row.
- Timetable date overrides are limited to the relevant calendar/upcoming
  horizon instead of loading the tutor's full override history.
- The calendar no longer renders hundreds of tiny forms in availability mode.
