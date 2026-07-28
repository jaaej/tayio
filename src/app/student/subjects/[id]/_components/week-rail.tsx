"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from "react";
import { Check, ChevronDown, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAccentTokens } from "@/lib/subject-colors";

type WeekRailItem = {
  subjectWeekId: string;
  weekNumber: number;
  title: string;
  topicId: string | null;
  topicName: string | null;
  videoWatched: boolean;
  bookletOpened: boolean;
  homeworkTotal: number;
  homeworkDone: number;
};

export type WeekRailProps = {
  subjectId: string;
  currentTermId: string;
  termsAvailable: Array<{ id: string; year: number; termNumber: number }>;
  weeks: WeekRailItem[];
  activeWeekId: string | null;
  currentWeekIdHint: string | null;
  onSelectWeek: (subjectWeekId: string) => void;
  pinned: boolean;
  onTogglePin: () => void;
  accent: ReturnType<typeof getAccentTokens>;
};

/** A week is "complete" once its video, booklet and (if any) homework are all done. */
function isWeekComplete(w: WeekRailItem) {
  const total = 2 + (w.homeworkTotal > 0 ? 1 : 0);
  const done =
    (w.videoWatched ? 1 : 0) +
    (w.bookletOpened ? 1 : 0) +
    (w.homeworkTotal > 0 && w.homeworkDone >= w.homeworkTotal ? 1 : 0);
  return total > 0 && done === total;
}

/** Group weeks by topic, first-occurrence order, one bucket per unique topic. */
function groupByTopic(weeks: WeekRailItem[]) {
  const map = new Map<string, WeekRailItem[]>();
  for (const w of weeks) {
    const label = w.topicName ?? "Other";
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(w);
  }
  return [...map.entries()].map(([label, items]) => ({ label, items }));
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * WeekRail - the slim collapsible week rail for the student curriculum page.
 *
 * Collapsed (default, not pinned): a ~56px strip of 44px week-number buttons,
 * a pin button, and a compact term selector. Hovering/focusing expands it to
 * ~248px as an absolutely-positioned overlay that floats over the page
 * content without reflowing it. Pinning locks the expanded layout in normal
 * flow (the parent shell gives it a real 248px grid column).
 *
 * Presentation + callbacks only - no data fetching, no URL/window logic
 * beyond the term-selector's server navigation, no localStorage. The parent
 * shell owns active-week state, pin persistence, and layout.
 */
export function WeekRail({
  subjectId,
  currentTermId,
  termsAvailable,
  weeks,
  activeWeekId,
  currentWeekIdHint,
  onSelectWeek,
  pinned,
  onTogglePin,
  accent,
}: WeekRailProps) {
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const active = activeWeekId ?? currentWeekIdHint ?? weeks[0]?.subjectWeekId ?? null;
  const expanded = pinned || hoverExpanded;
  const groups = groupByTopic(weeks);
  const showTopicHeadings = groups.length > 1;
  const base = `/student/subjects/${subjectId}`;

  const asideRef = useRef<HTMLElement>(null);
  const weekRefs = useRef(new Map<string, HTMLButtonElement>());
  const [focusedWeekId, setFocusedWeekId] = useState<string | null>(null);
  const [contentEntering, setContentEntering] = useState(false);

  // Cross-fade the swapped list content (collapsed <-> expanded) on every
  // toggle instead of letting it pop in with the width/box-shadow change.
  useEffect(() => {
    setContentEntering(false);
    const raf = requestAnimationFrame(() => setContentEntering(true));
    return () => cancelAnimationFrame(raf);
  }, [expanded]);

  // Collapsed and expanded weeks are separate DOM subtrees (different button
  // markup), so swapping between them unmounts whichever one currently has
  // focus. Track which week last held focus and, once the swap commits,
  // refocus the same week's button in the freshly-mounted list so keyboard
  // focus never drops to <body>.
  useLayoutEffect(() => {
    if (!focusedWeekId) return;
    const el = weekRefs.current.get(focusedWeekId);
    if (el && document.activeElement !== el) {
      el.focus();
    }
  }, [expanded, focusedWeekId]);

  const collapseOnBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setHoverExpanded(false);
    }
  };

  const handleMouseLeave = () => {
    // Don't collapse while focus is still inside the rail - e.g. a keyboard
    // user tabbing through week rows while the mouse happens to leave.
    if (asideRef.current?.contains(document.activeElement)) return;
    setHoverExpanded(false);
  };

  const pinButton = (
    <button
      type="button"
      onClick={onTogglePin}
      aria-pressed={pinned}
      aria-label={pinned ? "Unpin week list" : "Pin week list open"}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border transition-colors motion-reduce:transition-none",
        FOCUS_RING,
        pinned
          ? "border-transparent"
          : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink",
      )}
      style={pinned ? { background: accent.pillBg, color: accent.pillText } : undefined}
    >
      {pinned ? (
        <PinOff className="h-4 w-4" aria-hidden />
      ) : (
        <Pin className="h-4 w-4" aria-hidden />
      )}
    </button>
  );

  const termSelect = (compact: boolean) => (
    <div className="relative flex-1">
      <select
        value={currentTermId}
        onChange={(e) => {
          window.location.href = `${base}?term=${e.target.value}`;
        }}
        aria-label="Select term"
        className={cn(
          "h-11 w-full appearance-none rounded-[14px] border border-line bg-surface font-bold text-ink transition-colors motion-reduce:transition-none",
          "hover:bg-surface-2",
          FOCUS_RING,
          compact ? "px-1 text-center text-[11px]" : "pl-3 pr-8 text-[12px]",
        )}
      >
        {termsAvailable.map((t) => (
          <option key={t.id} value={t.id}>
            {compact ? `T${t.termNumber}` : `Term ${t.termNumber} · ${t.year}`}
          </option>
        ))}
      </select>
      {!compact && (
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        />
      )}
    </div>
  );

  const collapsedWeekButton = (w: WeekRailItem) => {
    const isActive = w.subjectWeekId === active;
    const complete = isWeekComplete(w);
    return (
      <button
        key={w.subjectWeekId}
        ref={(el) => {
          if (el) weekRefs.current.set(w.subjectWeekId, el);
          else weekRefs.current.delete(w.subjectWeekId);
        }}
        type="button"
        onClick={() => onSelectWeek(w.subjectWeekId)}
        onFocus={() => setFocusedWeekId(w.subjectWeekId)}
        onBlur={() =>
          setFocusedWeekId((cur) => (cur === w.subjectWeekId ? null : cur))
        }
        aria-current={isActive ? "true" : undefined}
        aria-label={`Week ${w.weekNumber}${complete ? ", completed" : ""}`}
        className={cn(
          "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[13px] font-extrabold tabular-nums transition-colors motion-reduce:transition-none",
          FOCUS_RING,
          isActive ? "text-white" : "text-ink hover:bg-surface-2",
        )}
        style={isActive ? { background: accent.arrow } : undefined}
      >
        {w.weekNumber}
        {/* A completed AND active week shows no check here - the accent fill
            already marks it; adding a check would be redundant on the active
            state, so this is intentionally collapsed && !isActive only. */}
        {complete && !isActive && (
          <Check
            aria-hidden
            strokeWidth={3}
            className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-good-bg p-[2px] text-good"
          />
        )}
      </button>
    );
  };

  const expandedWeekRow = (w: WeekRailItem) => {
    const isActive = w.subjectWeekId === active;
    const isCurrent = w.subjectWeekId === currentWeekIdHint;
    const complete = isWeekComplete(w);
    return (
      <button
        key={w.subjectWeekId}
        ref={(el) => {
          if (el) weekRefs.current.set(w.subjectWeekId, el);
          else weekRefs.current.delete(w.subjectWeekId);
        }}
        type="button"
        onClick={() => onSelectWeek(w.subjectWeekId)}
        onFocus={() => setFocusedWeekId(w.subjectWeekId)}
        onBlur={() =>
          setFocusedWeekId((cur) => (cur === w.subjectWeekId ? null : cur))
        }
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "block w-full rounded-[14px] border px-3 py-2.5 text-left transition-colors motion-reduce:transition-none",
          FOCUS_RING,
          isActive
            ? "border-transparent text-white"
            : "border-line bg-surface text-ink hover:bg-surface-2",
        )}
        style={isActive ? { background: accent.arrow } : undefined}
      >
        <div className="flex items-center justify-between gap-1.5">
          <span
            className={cn(
              "text-[10px] font-extrabold uppercase tracking-[0.12em]",
              isActive ? "text-white/85" : "text-muted",
            )}
          >
            Week {w.weekNumber}
          </span>
          <span className="flex items-center gap-1">
            {isCurrent && !isActive && (
              <span
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.1em]",
                  "border-line-strong text-muted",
                )}
              >
                Now
              </span>
            )}
            {complete && (
              <>
                <Check
                  aria-hidden
                  strokeWidth={3}
                  className={cn("h-3.5 w-3.5", isActive ? "text-white" : "text-good")}
                />
                <span className="sr-only">Completed</span>
              </>
            )}
          </span>
        </div>
        <div className="mt-0.5 line-clamp-2 text-[13px] font-bold leading-snug">
          {w.title}
        </div>
        {w.homeworkTotal > 0 && (
          <div className="mt-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-bold tabular-nums",
                isActive
                  ? "bg-white/25 text-white"
                  : w.homeworkDone >= w.homeworkTotal
                    ? "bg-good-bg text-good"
                    : "bg-warn-bg text-warn",
              )}
            >
              {w.homeworkDone}/{w.homeworkTotal}
            </span>
          </div>
        )}
      </button>
    );
  };

  const collapsedList = (
    <div className="flex flex-col items-center gap-1.5 overflow-y-auto px-1 py-1">
      {weeks.map((w) => collapsedWeekButton(w))}
    </div>
  );

  const expandedList = (
    <div className="flex flex-col gap-2 overflow-y-auto px-2 py-1">
      {groups.map((g) => (
        <div key={g.items[0]?.topicId ?? g.label}>
          {showTopicHeadings && (
            <div className="px-1 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
              {g.label}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            {g.items.map((w) => expandedWeekRow(w))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative h-full">
      <aside
        ref={asideRef}
        aria-label="Week navigation"
        onMouseEnter={!pinned ? () => setHoverExpanded(true) : undefined}
        onMouseLeave={!pinned ? handleMouseLeave : undefined}
        onFocus={!pinned ? () => setHoverExpanded(true) : undefined}
        onBlur={!pinned ? collapseOnBlur : undefined}
        className={cn(
          "flex h-full flex-col gap-2 rounded-[18px] border border-line bg-surface p-2",
          "transition-[width,box-shadow] duration-200 ease-out motion-reduce:transition-none",
          pinned
            ? "static w-full"
            : cn(
                "absolute inset-y-0 left-0 z-20 overflow-hidden",
                expanded
                  ? "w-[248px] shadow-[0_12px_28px_-14px_rgba(15,17,30,0.3)]"
                  : "w-14 shadow-none",
              ),
        )}
      >
        <div className={cn("flex items-center gap-1.5", expanded ? "px-0.5" : "flex-col")}>
          {pinButton}
          {termSelect(!expanded)}
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 transition-opacity duration-200 ease-out motion-reduce:transition-none",
            contentEntering ? "opacity-100" : "opacity-0",
          )}
        >
          {expanded ? expandedList : collapsedList}
        </div>
      </aside>
    </div>
  );
}
