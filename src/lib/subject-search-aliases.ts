import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { subjectSearchAliases, subjects } from "@/db/schema";

export type SubjectSearchAliasRow = {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  alias: string | null;
};

export async function getSubjectSearchAliases(): Promise<
  SubjectSearchAliasRow[]
> {
  return db
    .select({
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      alias: subjectSearchAliases.alias,
    })
    .from(subjects)
    .leftJoin(
      subjectSearchAliases,
      eq(subjectSearchAliases.subjectId, subjects.id),
    )
    .orderBy(asc(subjects.name));
}
