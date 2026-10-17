import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { subjectSearchAliases, subjects } from "@/db/schema";
import { distinctSubjects } from "@/lib/subject-label";

export type SubjectSearchAliasRow = {
  subjectId: string;
  subjectName: string;
  /** The name to show: with the year level where two subjects share a name. */
  subjectLabel: string;
  subjectColor: string | null;
  alias: string | null;
};

export async function getSubjectSearchAliases(): Promise<
  SubjectSearchAliasRow[]
> {
  const rows = await db
    .select({
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectYearLevel: subjects.yearLevel,
      subjectColor: subjects.color,
      alias: subjectSearchAliases.alias,
    })
    .from(subjects)
    .leftJoin(
      subjectSearchAliases,
      eq(subjectSearchAliases.subjectId, subjects.id),
    )
    .orderBy(asc(subjects.name));
  const labels = new Map(
    distinctSubjects(
      rows.map((r) => ({ id: r.subjectId, name: r.subjectName, yearLevel: r.subjectYearLevel })),
    ).map((s) => [s.id, s.label]),
  );
  return rows.map(({ subjectYearLevel: _level, ...r }) => ({
    ...r,
    subjectLabel: labels.get(r.subjectId) ?? r.subjectName,
  }));
}
