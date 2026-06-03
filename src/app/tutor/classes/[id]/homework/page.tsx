import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
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
        return {
          id: i.id,
          title: i.title,
          dueDate: i.dueDate,
          toMark,
          total,
          marked,
        };
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
    <div className="space-y-5">
      <Link
        href="/tutor/classes"
        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-600 hover:text-brand-700"
      >
        ← Back to classes
      </Link>

      <PageHead
        eyebrow={cls.subjectName}
        title={`${cls.name} — Homework`}
        sub={
          <>
            Assign new homework via the{" "}
            <Link
              href={`/tutor/classes/${classId}/curriculum`}
              className="text-brand-600 font-bold hover:text-brand-700"
            >
              curriculum page
            </Link>
            .
          </>
        }
      />

      <Card className="overflow-hidden">
        <CardHead title="To mark" action={`${toMarkRows.length} item${toMarkRows.length === 1 ? "" : "s"}`} />
        <CardBody tight>
          {toMarkRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted text-center">
              Nothing waiting to mark.
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {toMarkRows.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/tutor/homework/${h.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-ink truncate">
                        {h.title}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        Due {formatDueDate(h.dueDate)}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <Pill tone="warn">{h.toMark} to review</Pill>
                      <span className="text-[11px] text-muted tabular-nums">
                        {h.marked}/{h.total} marked
                      </span>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-brand-600 shrink-0">
                      Open →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHead title="Due upcoming" action={`${dueRows.length} item${dueRows.length === 1 ? "" : "s"}`} />
        <CardBody tight>
          {dueRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted text-center">
              Nothing due in the near future.
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {dueRows.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/tutor/homework/${h.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-ink truncate">
                        {h.title}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        Due {formatDueDate(h.dueDate)}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted tabular-nums shrink-0">
                      {h.submittedCount}/{h.total} submitted
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-brand-600 shrink-0">
                      Open →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
