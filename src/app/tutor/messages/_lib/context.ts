import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  familyLinks,
  profiles,
  type UserRole,
} from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import {
  tutorConversationContext,
  type ConversationContext,
  type TaughtStudent,
} from "./context-label";

/**
 * Header context for the tutor's open conversation with a student or parent:
 * the student(s) the tutor teaches in it and their classes. Other roles (the
 * admin office) get no extra context.
 */
export async function getTutorConversationContext(
  tutorId: string,
  otherId: string,
  otherRole: UserRole,
): Promise<ConversationContext | null> {
  const kind = coarseRole(otherRole);
  if (kind !== "student" && kind !== "parent") return null;

  const base = db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      className: classes.name,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId));

  const rows =
    kind === "student"
      ? await base
          .where(
            and(
              eq(enrollments.studentId, otherId),
              eq(classes.tutorId, tutorId),
              isNull(enrollments.withdrawnAt),
            ),
          )
          .orderBy(asc(classes.name))
      : await base
          .innerJoin(familyLinks, eq(familyLinks.studentId, enrollments.studentId))
          .where(
            and(
              eq(familyLinks.parentId, otherId),
              eq(classes.tutorId, tutorId),
              isNull(enrollments.withdrawnAt),
            ),
          )
          .orderBy(asc(profiles.firstName), asc(classes.name));

  const byId = new Map<string, TaughtStudent>();
  for (const r of rows) {
    const s = byId.get(r.id) ?? {
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      classNames: [],
    };
    s.classNames.push(r.className);
    byId.set(r.id, s);
  }

  return tutorConversationContext({ id: otherId, kind }, [...byId.values()]);
}
