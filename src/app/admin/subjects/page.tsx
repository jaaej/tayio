import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { subjects, subjectWeeks } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { resolveCurrentTerm } from "@/lib/curriculum";
import { Empty, PageHeader, buttonVariants } from "@/components/admin/ui";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import { CreateSubjectPanel } from "../classes/_components/create-subject-panel";
import { SubjectBlock } from "../_components/subject-block";

export const dynamic = "force-dynamic";

export default async function AdminSubjectsPage() {
  await requireRole("admin");

  const [subjectList, currentTerm] = await Promise.all([
    db
      .select({ id: subjects.id, name: subjects.name, yearLevel: subjects.yearLevel })
      .from(subjects)
      .orderBy(asc(subjects.name)),
    resolveCurrentTerm(),
  ]);

  // One grouped count for the whole list, only when a term is running.
  const weekCounts = new Map<string, number>();
  if (currentTerm) {
    const rows = await db
      .select({ subjectId: subjectWeeks.subjectId, n: sql<number>`count(*)::int` })
      .from(subjectWeeks)
      .where(eq(subjectWeeks.termId, currentTerm.id))
      .groupBy(subjectWeeks.subjectId);
    for (const row of rows) weekCounts.set(row.subjectId, row.n);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Curriculum"
        sub={
          currentTerm
            ? `${currentTerm.year} Term ${currentTerm.termNumber}`
            : undefined
        }
        actions={
          <Link
            href="/admin/terms"
            className={buttonVariants({ variant: "glass", size: "lg" })}
          >
            Manage terms
          </Link>
        }
      />

      <GlassPanel
        title="Subjects"
        titleId="subjects-heading"
        meta={subjectList.length > 0 ? subjectList.length : undefined}
        action={<CreateSubjectPanel />}
      >
        {subjectList.length === 0 ? (
          <Empty>No subjects yet.</Empty>
        ) : (
          <div
            className="grid gap-2 p-2"
            style={{
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(250px, 100%), 1fr))",
            }}
          >
            {subjectList.map((s) => {
              const weeks = weekCounts.get(s.id) ?? 0;
              return (
                <SubjectBlock
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  yearLevel={s.yearLevel}
                  detail={
                    currentTerm
                      ? weeks === 0
                        ? "No weeks this term"
                        : `${weeks} week${weeks === 1 ? "" : "s"} this term`
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
