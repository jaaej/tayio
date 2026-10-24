import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GlassPanel, buttonVariants } from "@/components/admin/ui";
import {
  WeekTimeGrid,
  type TimeGridEvent,
} from "@/components/data/week-time-grid";
import { countLabel } from "@/components/data/week-time-grid-layout";
import { weekRangeLabel } from "@/lib/format";
import { addIsoDays } from "@/lib/tutor-checkin-rules";

const GLASS_ICON = buttonVariants({ variant: "glass", size: "icon" });

/**
 * "This week" on a portal home: the shared time grid with previous / next
 * week links (`?week=` on the home route) and a link to the full calendar.
 * Shared by the admin dashboard and tutor Today.
 */
export function WeekPanel({
  basePath,
  weekStart,
  todayIso,
  events,
  noun,
  calendarHref,
  calendarLabel,
  className,
}: {
  /** The home route that reads `?week=`, e.g. "/admin". */
  basePath: string;
  weekStart: string;
  todayIso: string;
  events: TimeGridEvent[];
  /** What one event is called in the count, singular: "class", "lesson". */
  noun: string;
  calendarHref: string;
  calendarLabel: string;
  className?: string;
}) {
  return (
    <GlassPanel
      className={className}
      title="This week"
      meta={`${weekRangeLabel(weekStart)} · ${countLabel(events.length, noun)}`}
      action={
        <>
          <Link
            href={`${basePath}?week=${addIsoDays(weekStart, -7)}`}
            aria-label="Previous week"
            className={GLASS_ICON}
          >
            <ChevronLeft className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden />
          </Link>
          <Link
            href={`${basePath}?week=${addIsoDays(weekStart, 7)}`}
            aria-label="Next week"
            className={GLASS_ICON}
          >
            <ChevronRight className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden />
          </Link>
          <Link
            href={calendarHref}
            className={buttonVariants({ variant: "glass", size: "md" })}
          >
            {calendarLabel}
          </Link>
        </>
      }
    >
      <WeekTimeGrid events={events} weekStart={weekStart} todayIso={todayIso} noun={noun} />
    </GlassPanel>
  );
}
