import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, profiles, type UserRole } from "@/db/schema";
import { canDM } from "@/lib/dm-permissions";
import { yearLevelLabel } from "@/lib/format";
import { coarseRole } from "@/lib/roles";
import { roleLabel } from "@/components/discussions/role-tone";
import type { AskedByPerson } from "@/components/discussions/asked-by-card";

/**
 * Who asked a thread, seen from the tutor's side: their year and the tutor's
 * class they sit in, plus the profile and message links the tutor is allowed
 * to open. Returns null when the tutor wrote the thread themselves.
 */
export async function getThreadAskerForTutor(
  tutorId: string,
  thread: {
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    subjectId: string | null;
  },
): Promise<AskedByPerson | null> {
  if (thread.authorId === tutorId) return null;

  const [canMessage, student] = await Promise.all([
    canDM(tutorId, "tutor", thread.authorId, thread.authorRole),
    coarseRole(thread.authorRole) === "student"
      ? loadStudentContext(tutorId, thread.authorId, thread.subjectId)
      : null,
  ]);

  const year = student?.yearLevel ? yearLevelLabel(student.yearLevel) : null;
  const meta = student
    ? [
        // Class names usually lead with the year ("Year 9 Maths"); don't say it twice.
        year && !student.className?.includes(year) ? year : null,
        student.className ?? roleLabel(thread.authorRole),
        student.className ? "your class" : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : roleLabel(thread.authorRole);

  return {
    name: thread.authorName,
    role: thread.authorRole,
    meta,
    profileHref: student?.className
      ? `/tutor/students/${thread.authorId}`
      : undefined,
    messageHref: canMessage
      ? `/tutor/messages/with/${thread.authorId}`
      : undefined,
  };
}

async function loadStudentContext(
  tutorId: string,
  studentId: string,
  subjectId: string | null,
) {
  const [profile, taught] = await Promise.all([
    db
      .select({ yearLevel: profiles.yearLevel })
      .from(profiles)
      .where(eq(profiles.id, studentId))
      .limit(1),
    db
      .select({ name: classes.name, subjectId: classes.subjectId })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(classes.tutorId, tutorId),
          isNull(enrollments.withdrawnAt),
        ),
      ),
  ]);
  // Prefer the class on this thread's subject board; fall back to any class
  // the tutor teaches them in (e.g. a question on the general board).
  const cls =
    taught.find((c) => subjectId !== null && c.subjectId === subjectId) ??
    taught[0];
  return {
    yearLevel: profile[0]?.yearLevel ?? null,
    className: cls?.name ?? null,
  };
}
