import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { db } from "@/db/client";
import { classes, homework, homeworkAssignments, subjects } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDueDate } from "@/lib/format";

export default async function TutorClassHomeworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("tutor");
  const { id: classId } = await params;

  // Verify tutor owns the class.
  const [cls] = await db
    .select({
      id: classes.id,
      name: classes.name,
      subjectName: subjects.name,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(and(eq(classes.id, classId), eq(classes.tutorId, user.id)))
    .limit(1);
  if (!cls) notFound();

  // All homework for this class.
  const items = await db
    .select({
      id: homework.id,
      title: homework.title,
      dueDate: homework.dueDate,
      createdAt: homework.createdAt,
    })
    .from(homework)
    .where(and(eq(homework.classId, classId), eq(homework.tutorId, user.id)))
    .orderBy(desc(homework.dueDate));

  let toMarkRows: Array<{
    id: string;
    title: string;
    dueDate: Date;
    toMark: number;
    total: number;
    marked: number;
  }> = [];
  let dueRows: Array<{
    id: string;
    title: string;
    dueDate: Date;
    total: number;
    submittedCount: number;
  }> = [];

  if (items.length > 0) {
    const ids = items.map((i) => i.id);
    const counts = await db
      .select({
        homeworkId: homeworkAssignments.homeworkId,
        status: homeworkAssignments.status,
        total: sql<number>`count(*)::int`,
      })
      .from(homeworkAssignments)
      .where(inArray(homeworkAssignments.homeworkId, ids))
      .groupBy(homeworkAssignments.homeworkId, homeworkAssignments.status);

    const now = new Date();

    toMarkRows = items
      .map((i) => {
        const rows = counts.filter((c) => c.homeworkId === i.id);
        const total = rows.reduce((a, r) => a + r.total, 0);
        const toMark = rows
          .filter((r) => r.status === "submitted" || r.status === "late")
          .reduce((a, r) => a + r.total, 0);
        const marked = rows
          .filter((r) => r.status === "marked" || r.status === "returned")
          .reduce((a, r) => a + r.total, 0);
        return { id: i.id, title: i.title, dueDate: i.dueDate, toMark, total, marked };
      })
      .filter((r) => r.toMark > 0)
      .sort((a, b) => b.toMark - a.toMark);

    dueRows = items
      .filter((i) => i.dueDate >= now)
      .map((i) => {
        const rows = counts.filter((c) => c.homeworkId === i.id);
        const total = rows.reduce((a, r) => a + r.total, 0);
        const submittedCount = rows
          .filter(
            (r) =>
              r.status === "submitted" ||
              r.status === "late" ||
              r.status === "marked" ||
              r.status === "returned",
          )
          .reduce((a, r) => a + r.total, 0);
        return {
          id: i.id,
          title: i.title,
          dueDate: i.dueDate,
          total,
          submittedCount,
        };
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  return (
    <div className="space-y-6">
      <Link
        href="/tutor/classes"
        className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
      >
        ← Back to classes
      </Link>

      <header className="space-y-1">
        <h1 className="text-3xl font-medium text-ink">
          {cls.name} — Homework
        </h1>
        <p className="text-sm text-ink-soft">
          {cls.subjectName} · Assign new homework via the{" "}
          <Link
            href={`/tutor/classes/${classId}/curriculum`}
            className="text-brand-700 hover:underline"
          >
            curriculum page
          </Link>
          .
        </p>
      </header>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline/60 flex items-baseline justify-between">
          <div className="text-base font-medium text-ink">To mark</div>
          <span className="text-xs text-muted tabular-nums">
            {toMarkRows.length}
          </span>
        </div>
        {toMarkRows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-ink-soft">
            Nothing waiting to mark.
          </div>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {toMarkRows.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/tutor/homework/${h.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-brand-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-base text-ink truncate">{h.title}</div>
                    <div className="text-xs text-muted mt-0.5">
                      Due {formatDueDate(h.dueDate)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-ink tabular-nums">
                      {h.marked}/{h.total} marked
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-amber-700 mt-0.5">
                      {h.toMark} to review
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-brand-700 shrink-0">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline/60 flex items-baseline justify-between">
          <div className="text-base font-medium text-ink">Due upcoming</div>
          <span className="text-xs text-muted tabular-nums">
            {dueRows.length}
          </span>
        </div>
        {dueRows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-ink-soft">
            Nothing due in the near future.
          </div>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {dueRows.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/tutor/homework/${h.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-brand-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-base text-ink truncate">{h.title}</div>
                    <div className="text-xs text-muted mt-0.5">
                      Due {formatDueDate(h.dueDate)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-ink tabular-nums">
                      {h.submittedCount}/{h.total} submitted
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-brand-700 shrink-0">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
