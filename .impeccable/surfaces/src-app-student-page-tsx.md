---
version: 1
slug: "src-app-student-page-tsx"
primary_target: "src/app/student/page.tsx"
related_targets: []
---

# Student dashboard (/student)

Mode: Operate. A student at a laptop opens the portal to reach a subject, see this week's classes, and see what is due.
Constraints: shared glass shell and kit (PageHeader, GlassPanel, TodoPanel) exactly as admin and tutor use them; glass subject tones from `src/lib/subject-tone.ts`; real data only; no announcements or contacts on this page (Notifications and Messages own them).
Owner reference: "Dashboard · colourful option" comp. Owner chose colourful but disciplined.

## Direction contract

THESIS: The dashboard is the student's week, not a welcome banner. It refuses the category default of a saturated greeting hero over a row of equally loud cards.
OWN-WORLD: The admin/tutor glass world. Translucent frames, white panels, ink primary buttons, Figtree, 24px frames. Colour belongs to subjects only: each subject is a pale fill of its own tone, and exactly one card, the subject on now or next, is the saturated version. No eyebrows, rings, confetti or per-row pills.
STORY: The student sees the date and week, knows which class is next, opens a subject in one click, and works down what is due in order of urgency.
FIRST VIEWPORT: Glass header (greeting, date, term and week; one ink action to the most urgent homework). Below it two columns: on the left the subject row (the next subject saturated, its next lesson the largest text on it) above To do; on the right This week (340px day list) running the full height, because the page is the student's week and the week frames everything on it. Each column ends with its content; a stretched To do would show an empty white panel on a light week.
FORM: Portal home in the established glass world, keeping the owner comp's regions (position 1 of 1). No concept roll: the owner asked to make their own comp less AI-looking, so its regions were kept and only the tells inside them changed; this is disclosed to the owner. Seed key: none.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
