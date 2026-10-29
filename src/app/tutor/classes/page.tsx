import Link from "next/link";
import {
  Empty,
  PageHeader,
  buttonVariants,
} from "@/components/admin/ui";
import { classDisplayName } from "@/lib/class-display";
import { formatTimeRange } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { getLessonWeek } from "@/lib/week-plans";
import { getTutorClasses, requireTutor } from "../_data";
import { getNextLessonDateByClass } from "./_lib/queries";

export const dynamic = "force-dynamic";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LINE_BUTTON = buttonVariants({ variant: "outline", size: "md" });

export default async function TutorClassesPage() {
  const tutor = await requireTutor();
  const todayIso = melbourneDate(new Date());

  const [list, nextByClass] = await Promise.all([
    getTutorClasses(tutor.id),
    getNextLessonDateByClass(tutor.id, todayIso),
  ]);

  const weeks = await Promise.all(list.map((c) => getLessonWeek(c.id, todayIso)));
  const weekByClass = new Map(list.map((c, i) => [c.id, weeks[i]]));

  // Classes with a lesson coming up first, soonest first; the rest by name.
  const sorted = [...list].sort((a, b) => {
    const na = nextByClass.get(a.id);
    const nb = nextByClass.get(b.id);
    if (na && nb && na !== nb) return na.localeCompare(nb);
    if (na && !nb) return -1;
    if (!na && nb) return 1;
    return (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Classes" />

      {/* Same frame as GlassPanel, but each class card is its own white
          panel on the glass instead of one shared body. */}
      <section aria-labelledby="your-classes" className="glass rise flex min-w-0 flex-col rounded-[24px] p-1.5">
        <div className="flex min-h-12 items-center py-1.5 pl-3 pr-1.5">
          <h2 id="your-classes" className="text-[16px] font-extrabold text-ink">
            Your classes
          </h2>
        </div>
        {sorted.length === 0 ? (
          <div className="panel">
            <Empty>An admin needs to assign you to a class before it appears here.</Empty>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-1.5">
            {sorted.map((c) => {
              const tone = subjectTone(c.subjectName, c.subjectColor);
              const name = classDisplayName(c.subjectName, c.name);
              const week = weekByClass.get(c.id);
              const when =
                typeof c.weekday === "number" && c.startTime && c.endTime
                  ? `${WEEKDAY[c.weekday]} · ${formatTimeRange(c.startTime, c.endTime)}`
                  : "-";
              const where = c.location ?? "-";
              return (
                <article key={c.id} className="panel flex flex-col gap-3.5 p-4">
                  <div className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] text-[15px] font-extrabold"
                      style={{ backgroundColor: tone.bg, color: tone.fg }}
                    >
                      {name.replace(/^VCE\s+/i, "").charAt(0).toUpperCase()}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <h3 className="text-[15px] font-extrabold text-ink">{name}</h3>
                      {week && (
                        <span className="text-[12px] text-muted">
                          Week {week.weekNumber} · {week.title}
                        </span>
                      )}
                    </span>
                  </div>
                  <dl className="grid grid-cols-[64px_1fr] gap-y-1.5 text-[13px]">
                    <dt className="font-semibold text-muted">When</dt>
                    <dd className="font-bold text-ink tabular-nums">{when}</dd>
                    <dt className="font-semibold text-muted">Where</dt>
                    <dd className="truncate font-bold text-ink">{where}</dd>
                  </dl>
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <Link href={`/tutor/classes/${c.id}/curriculum`} className={LINE_BUTTON}>
                      Week plan
                    </Link>
                    <Link href={`/tutor/classes/${c.id}/lessons`} className={LINE_BUTTON}>
                      Lessons
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
