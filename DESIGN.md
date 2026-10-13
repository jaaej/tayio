---
name: Taiyo Tuition Portal
description: The glass portal world shared by the admin, tutor and student portals of a tutoring company.
colors:
  ink: "#17152b"
  ink-hover: "#2b2847"
  ink-soft: "#2e2944"
  muted: "#5e5a73"
  muted-2: "#8c8aa0"
  surface: "#ffffff"
  surface-2: "#f5f6fa"
  surface-3: "#eeeff6"
  line: "#eff0f5"
  line-strong: "#dfe1ec"
  line-field: "#8790ad"
  wash-light: "#f4f6fc"
  wash-mid: "#dce0f4"
  wash-deep: "#bec2ea"
  wash-violet: "#9291dc"
  brand-50: "#f7f6fe"
  brand-100: "#eeebfd"
  brand-400: "#7c62f0"
  brand-600: "#3a1aa8"
  brand-700: "#21106b"
  good: "#15803d"
  good-bg: "#e3f4ec"
  warn: "#8a4a06"
  warn-bg: "#fdf1e0"
  bad: "#b42318"
  bad-bg: "#fde8e8"
  info: "#1e4fb8"
  info-bg: "#e7effd"
  alert-badge: "#d92d20"
  maths-dot: "#2e9c86"
  maths-bg: "#ddf3ee"
  maths-fg: "#0b5c4e"
  maths-solid: "#1b7a67"
  english-dot: "#7c62f0"
  english-bg: "#eeebfd"
  english-fg: "#3a1aa8"
  english-solid: "#5e3fe0"
  science-dot: "#4c7fe8"
  science-bg: "#e7effd"
  science-fg: "#1e4fb8"
  science-solid: "#2f62cf"
  senior-dot: "#d2588f"
  senior-bg: "#fbe8f1"
  senior-fg: "#9d2c61"
  senior-solid: "#b33f75"
  other-dot: "#8c8aa0"
  other-bg: "#eeeff6"
  other-fg: "#4a4660"
  other-solid: "#5e5a73"
typography:
  headline:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.25
  title-subject:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title-featured:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 800
  body-strong:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  meta:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  micro:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 800
rounded:
  chip-dot: "3px"
  control-sm: "9px"
  control: "10px"
  tile: "11px"
  control-lg: "12px"
  panel: "16px"
  subject-card: "22px"
  frame: "24px"
  sheet: "26px"
  pill: "999px"
spacing:
  frame-inset: "0.375rem"
  row-gap: "0.375rem"
  card-gap: "0.75rem"
  gutter: "1.25rem"
  row-x: "1rem"
  card-pad: "1.25rem"
  week-column: "340px"
  sidebar: "236px"
  sidebar-rail: "76px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control-lg}"
    height: "42px"
    padding: "0 16px"
    typography: "{typography.body-strong}"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-outline-hover:
    backgroundColor: "{colors.surface-2}"
  button-glass:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  glass-frame:
    rounded: "{rounded.frame}"
    padding: "{spacing.frame-inset}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  page-header:
    rounded: "{rounded.frame}"
    padding: "14px 18px 14px 22px"
    typography: "{typography.headline}"
  nav-item:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.control}"
    padding: "7px 10px"
    typography: "{typography.body}"
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  count-badge:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "20px"
    typography: "{typography.micro}"
  subject-card-pale:
    backgroundColor: "{colors.maths-bg}"
    textColor: "{colors.maths-fg}"
    rounded: "{rounded.subject-card}"
    padding: "{spacing.card-pad}"
    typography: "{typography.title-subject}"
  subject-card-featured:
    backgroundColor: "{colors.maths-solid}"
    textColor: "{colors.surface}"
    rounded: "{rounded.subject-card}"
    padding: "{spacing.card-pad}"
  lesson-chip:
    backgroundColor: "{colors.english-bg}"
    textColor: "{colors.english-fg}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 10px"
    typography: "{typography.label}"
  lesson-chip-past:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.muted}"
  todo-tile:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn}"
    rounded: "{rounded.tile}"
    size: "38px"
---

# Design System: Taiyo Tuition Portal

## Overview

**Creative North Star: "The Week Under Glass"**

The portal is a calm, light working space: frosted frames float over a pale wash that deepens from white at the top left to soft violet at the bottom right.
Every piece of content sits on a solid white panel set inside a translucent frame, so the glass gives the page depth while the text always reads on white.
Ink, a near-black violet, is the only strong neutral and it carries meaning: where you are, and the one thing to do next.
Colour beyond that belongs to subjects, and on a home surface only one subject is allowed to be loud.

The world was built for the admin and tutor portals and now carries the student portal on the same shell, kit and tokens.
Density is moderate: compact rows (about 60px) with one action each, a 20px gutter between frames, and type that is bold rather than large.
Hierarchy comes from weight, one saturated fill and placement, not from decoration.

**Key Characteristics:**
- Translucent glass frames with a 6px inset around solid white panels.
- Fixed diagonal wash behind everything, holding still while the window scrolls.
- Figtree throughout, extrabold (800) for titles and numbers, no separate display face.
- Ink fills reserved for the current location, the primary action, today and counts.
- Subject tones as pale fills, with one saturated subject on a home surface.
- Status colours (good, warn, bad, info) kept to tinted icon tiles and due chips.

## Colors

A quiet violet-grey field with one ink voice, and colour handed to subjects rather than to chrome.

### Primary
- **Torii Ink** (ink): the primary action button, the active nav item, the selected segment, today's date disc, and count badges.
  Its hover is a lifted ink (ink-hover).
- **Wash** (white to wash-light, wash-mid, wash-deep, wash-violet at 0 / 18 / 45 / 72 / 100% on a 120 degree gradient): the fixed page backdrop behind every glass frame.

### Secondary
- **Subject Tones** (maths, english, science, senior, other; each with dot, bg, fg and solid): a subject's identity everywhere it appears.
  The dot (a 9px rounded square) marks a subject beside a name in admin and tutor lists; bg with fg is the pale card or chip; solid with white text is the single featured fill.
  Families are matched by subject name in `src/lib/subject-tone.ts`, and VCE maths studies take the senior tone.
- **Violet Accent** (brand-400): the 2px focus ring on controls.
  The brand-50 to brand-700 steps tint quiz tiles (brand-50 with brand-700) and link text (brand-600).

### Tertiary
- **Status Pairs** (good, warn, bad, info, each with its bg): tinted icon tiles in To do rows, due-date chips in the week list, and status pills in admin tables.
  The alert badge red marks danger counts in the nav.

### Neutral
- **Ink Soft** (ink-soft): secondary text on the wash and on glass, where muted would fall below AA at the dark end of the gradient.
- **Muted** (muted): detail lines and empty states on white panels.
- **Muted Two** (muted-2): the faintest neutral, for non-essential hints only.
- **Panel White** (surface), **Hover Grey** (surface-2), **Neutral Fill** (surface-3): panels, row and outline-button hovers, and neutral chips such as a finished lesson.
- **Hairline** (line) and **Firm Line** (line-strong): row dividers inside panels and outline-button borders.
- **Field Edge** (line-field): input boundaries, at 3.16:1 on white so a field never reads as white on white.

### Named Rules
**The Subjects Own Colour Rule.** Saturated colour on a page belongs to subjects; chrome, headers and panels stay ink, white and glass.

**The One Saturated Subject Rule.** On a home surface every subject is its pale fill except one, the subject on now or next, which takes its solid fill with white text; a live lesson chip in the week list is the only other solid.

**The Ink Means Here Rule.** An ink fill says "you are here" or "do this": the active nav item, the selected segment, today, the primary button, a count.
A feature link that is neither (the student's Taiyo Blitz entry) is white, not ink.

## Typography

**Display Font:** none; Figtree carries every role.
**Body Font:** Figtree (with ui-sans-serif, system-ui fallback), loaded through `next/font` and applied by the glass scope.

**Character:** One friendly geometric sans that turns authoritative at 800, so a title reads as a title through weight rather than size.

### Hierarchy
- **Headline** (800, 22px, 1.25): the page title inside the glass page header.
- **Subject Title** (800, 19px, -0.015em): the subject name on a subject card.
- **Featured Title** (800, 18px, -0.01em): the next-lesson line on the one featured subject card, the largest text on it; pale cards keep the same line at 13px.
- **Title** (800, 16px): panel titles in a glass frame's title row.
- **Body Strong** (700, 14px): To do row titles and button labels at large size.
- **Body** (500, 14px): nav items and running text.
- **Meta** (500, 13px): the page header's date and term line, row details, panel title meta.
- **Label** (700, 12px): chips, small buttons, metric labels.
- **Micro** (800, 11px): count badges; nav group headings and weekday abbreviations use it in uppercase.

The root size is 17px, so rem-based spacing is 17/16 of Tailwind's nominal values while the type sizes above are literal pixels.

### Named Rules
**The Weight Not Size Rule.** Raise importance with weight (800) before size; the page title is only 22px.

**The Functional Uppercase Rule.** Uppercase is for nav group headings (0.1em), weekday abbreviations in a date column (0.06em) and the TUITION wordmark only; nothing sits above a title as a kicker.

## Layout

On desktop a floating glass sidebar (236px, collapsing to a 76px rail) sits at 1.25rem from the window edges and fills the viewport height; the page column beside it starts with the glass page header.
Frames are separated by a 1.25rem gutter, and the window is the only scroller so sticky elements pin to the viewport.
Phones replace the sidebar with a compact sticky glass header and menu, and the page column takes 1rem side padding.

The student home is two columns from the large breakpoint: a flexible left column (subject cards above To do) and a fixed 340px This week column on the right.
Both columns are top-aligned and end with their content, so a light week never shows a stretched empty panel.
Subject cards sit in a grid with a 0.75rem gap: one column, two from small screens, then auto-fit at a 220px minimum.

Rows inside panels use 1rem side padding and about 13px vertical padding, separated by hairlines; a week day row holds at least 60px.

## Elevation & Depth

Depth is glass over a wash, not stacked shadows.
A frame is a translucent white layer with a 24px blur, a white inset top highlight and one broad, faint violet shadow; the white panel inside it lifts only by a 1px hairline shadow.
Shadows deepen as a response to hover, and the one featured subject card carries a stronger resting shadow because it is the one thing raised off the page.

### Shadow Vocabulary
- **Frame** (`0 18px 50px rgba(60, 62, 150, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.85)` with `backdrop-filter: blur(24px) saturate(160%)`): sidebar, page header, every glass panel.
- **Panel** (`0 1px 2px rgba(23, 21, 43, 0.06)`): white panels and pale subject cards at rest.
- **Hover Lift** (`0 14px 30px -16px rgba(23, 21, 43, 0.35)`): pale subject cards and feature links on hover, paired with a 2-3px rise.
- **Featured** (`0 14px 32px -12px rgba(23, 21, 43, 0.45)`, hover `0 20px 40px -14px rgba(23, 21, 43, 0.5)`): the saturated subject card only.
- **Sheet** (`0 30px 80px rgba(23, 21, 43, 0.28)` with a 28px blur): the floating side panel, inset 16px from the window.

### Named Rules
**The Text On White Rule.** Glass carries titles and controls; content always sits on a solid white panel, so readability never depends on what is behind the frame.

## Shapes

Generous, soft corners that step down as elements nest: sheet (26px), frame (24px), subject card (22px), panel (16px), large button (12px), icon tile (11px), control and nav item (10px), small button (9px).
Chips, badges and the today disc are full pills (999px); the subject dot is a 3px rounded square.
Borders are rare: glass edges are a 70% white hairline, outline buttons take the firm line, and fields take the field edge.

## Components

### Buttons
- **Shape:** gently rounded, sized to context: small (30px, 9px radius) in table rows, medium (36px, 10px) in section headers and rows, large (42px, 12px) in page headers.
- **Primary:** ink fill, white bold label; one per surface, the main action.
- **Hover / Focus:** a 150ms colour shift to the lifted ink; focus is a 2px violet ring with a 1px offset.
- **Glass:** 65% white fill with a 95% white border, for buttons sitting directly on a frame or page header.
- **Outline:** white with the firm line border, for the single action on a To do row.
- **Ghost:** no chrome until hover, ink-soft text.

### Chips
- **Lesson chip:** a 28px pill in the subject's pale fill and fg text, 12px bold; a live lesson takes the solid fill with white text and a pulsing white dot (motion-safe only).
- **Past lesson:** turns to the neutral fill with muted text rather than fading, so contrast holds.
- **Due chip:** warn pair, links to the homework.

### Cards / Containers
- **Glass panel:** frame with a 6px inset, a title row (16px extrabold title, optional meta, right-aligned actions) and a white panel body.
- **Subject card:** a link with 22px radius and 1.25rem padding, subject name, tutor, this week's topic and the next lesson; it rises 3px on hover over 200ms ease-out.
- **Metric tile:** white panel with a 12px label and 22px extrabold number; the selected filter tile turns ink.

### Inputs / Fields
- **Style:** white field with the field edge border, so the boundary meets WCAG 1.4.11.
- **Focus:** the 2px violet ring.

### Navigation
- **Sidebar:** brand lockup, search, an optional feature link, then the menu on a white scrolling panel, and the account row at the foot.
- **Items:** 14px medium ink-soft with a 17px icon; hover is a pale grey fill; the active item is an ink fill with white bold text.
- **Group headings:** 11px extrabold uppercase muted at 0.1em.
- **Badges:** 20px pills, neutral by default, white on the active item, alert red for danger counts.

### To do panel
The shared To do list on admin, tutor and student homes: one row per thing waiting, most urgent first, each with a 38px tinted icon tile in its status tone, a bold title, a muted detail line and one outline action.
The title carries an ink count badge; a summary row may stand for several items, and the badge counts them all.

### Week list
Monday to Sunday as rows with the weekday and date in a 40px column; today is labelled Today and its date sits in the ink disc, and finished days drop the date to muted.
Lessons appear as subject chips and homework due that day as warn chips.

## Do's and Don'ts

### Do:
- **Do** put every surface on the shared glass shell and kit (PageHeader, GlassPanel, TodoPanel, buttonVariants) so a feature looks the same in each role.
- **Do** set content on the white panel inside a frame, never directly on glass.
- **Do** give exactly one subject its solid fill on a home surface, the subject on now or next, and keep the rest pale.
- **Do** make the featured card's next lesson its largest text (18px extrabold).
- **Do** reserve ink fills for the active nav item, the selected segment, today, the primary action and counts.
- **Do** turn finished items neutral (neutral fill, muted text) instead of lowering their opacity.
- **Do** use ink-soft, not muted, for secondary text that sits on the wash or on glass.
- **Do** keep hover motion to a 2-3px rise and a deeper shadow over 150-200ms.

### Don't:
- **Don't** open a page with a saturated greeting hero; the page header is a glass strip with the title, the date and term, and at most one ink action.
- **Don't** put a kicker or eyebrow above a title; the title stands alone.
- **Don't** paint chrome, headers or whole panels in a subject or brand colour.
- **Don't** give more than one subject card its saturated fill at once.
- **Don't** add progress rings, confetti or celebration graphics to a portal home.
- **Don't** append a status pill to every To do row or subject card; a row's state lives in its icon tile tone and its single action.
- **Don't** use a subject tone to mean a status, or a status colour to mean a subject.
- **Don't** substitute framework defaults for the radius and shadow values above.
