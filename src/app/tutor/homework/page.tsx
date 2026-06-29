import Link from "next/link";
import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { formatDueDate } from "@/lib/format";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { getTutorMarkingQueue, requireTutor } from "../_data";

export default async function TutorHomeworkPage() {
  const tutor = await requireTutor();
  const rows = await getTutorMarkingQueue(tutor.id);

  // Rows arrive subject-ordered; collapse contiguous runs into subject groups.
  const groups: Array<{
    subjectId: string | null;
    subjectName: string;
    rows: typeof rows;
  }> = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.subjectId === r.subjectId) {
      last.rows.push(r);
    } else {
      groups.push({
        subjectId: r.subjectId,
        subjectName: r.subjectName ?? "Other",
        rows: [r],
      });
    }
  }

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Marking"
        title="Marking queue"
        sub={
          rows.length === 0
            ? "Nothing waiting to mark"
            : `${rows.length} submission${rows.length === 1 ? "" : "s"} to mark across ${groups.length} subject${groups.length === 1 ? "" : "s"}`
        }
      />

      {rows.length === 0 ? (
        <Card>
          <CardBody>
            <div className="px-2 py-6 text-sm text-muted text-center">
              All caught up — nothing waiting to mark. Assign new homework from a
              class&apos;s{" "}
              <Link
                href="/tutor/classes"
                className="text-brand-600 font-bold hover:text-brand-700"
              >
                curriculum
              </Link>
              .
            </div>
          </CardBody>
        </Card>
      ) : (
        groups.map((g) => {
          const accent = getAccentTokens(colorFamilyForSubject(g.subjectName));
          const initial = g.subjectName.charAt(0).toUpperCase();
          return (
            <Card key={g.subjectId ?? "none"} className="overflow-hidden">
              <div
                className="px-4 py-3 flex items-center gap-3 border-b border-line"
                style={{
                  background: `linear-gradient(135deg, ${accent.bgFrom} 0%, ${accent.bgTo} 100%)`,
                }}
              >
                <div
                  className="h-9 w-9 rounded-[10px] grid place-items-center text-[14px] font-extrabold shrink-0"
                  style={{ background: accent.title, color: "#fff" }}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[14px] font-extrabold leading-tight truncate"
                    style={{ color: accent.title }}
                  >
                    {g.subjectName}
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-[0.12em] font-bold"
                    style={{ color: accent.meta }}
                  >
                    {g.rows.length} to mark
                  </div>
                </div>
              </div>
              <CardBody tight>
                <ul className="divide-y divide-line">
                  {g.rows.map((r) => (
                    <li key={`${r.homeworkId}-${r.studentId}`}>
                      <Link
                        href={`/tutor/homework/${r.homeworkId}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold text-ink truncate">
                            {r.firstName} {r.lastName}
                          </div>
                          <div className="text-[11px] text-muted mt-0.5 truncate">
                            {r.homeworkTitle} · due {formatDueDate(r.dueDate)}
                          </div>
                        </div>
                        <Pill tone={r.status === "late" ? "warn" : "info"}>
                          {r.status === "late" ? "Late" : "Submitted"}
                        </Pill>
                        <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-brand-600 shrink-0">
                          Mark →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}
