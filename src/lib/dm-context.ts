import "server-only";
import { and, asc, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  familyLinks,
  profiles,
  type UserRole,
} from "@/db/schema";
import { coarseRole, type CoarseRole } from "@/lib/roles";
import { conversationContextLabel, type LinkedStudent } from "@/lib/dm-context-label";

export type ConversationContext = {
  /** Who the other person is to the viewer; null keeps the role label. */
  context: string | null;
  profileHref?: string;
  profileLabel?: string;
};

/**
 * Students matching `studentFilter` (optionally reached through a parent's
 * family links) with their active classes, limited to one tutor's classes
 * when `tutorId` is set. With a tutor limit, students sharing no class are
 * dropped so a tutor never learns about children they don't teach.
 */
async function linkedStudents({
  studentId,
  parentId,
  tutorId,
}: {
  studentId?: string;
  parentId?: string;
  tutorId?: string;
}): Promise<LinkedStudent[]> {
  const classJoin: SQL[] = [eq(classes.id, enrollments.classId)];
  if (tutorId) classJoin.push(eq(classes.tutorId, tutorId));
  const base = db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      className: classes.name,
    })
    .from(profiles)
    .leftJoin(
      enrollments,
      and(eq(enrollments.studentId, profiles.id), isNull(enrollments.withdrawnAt)),
    )
    .leftJoin(classes, and(...classJoin));
  const rows = parentId
    ? await base
        .innerJoin(familyLinks, eq(familyLinks.studentId, profiles.id))
        .where(eq(familyLinks.parentId, parentId))
        .orderBy(asc(profiles.firstName), asc(classes.name))
    : await base.where(eq(profiles.id, studentId!)).orderBy(asc(classes.name));

  const byId = new Map<string, LinkedStudent>();
  for (const r of rows) {
    const s = byId.get(r.id) ?? {
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      classNames: [],
    };
    if (r.className) s.classNames.push(r.className);
    byId.set(r.id, s);
  }
  const all = [...byId.values()];
  return tutorId ? all.filter((s) => s.classNames.length > 0) : all;
}

async function tutorClassNames(tutorId: string): Promise<string[]> {
  const rows = await db
    .select({ name: classes.name })
    .from(classes)
    .where(eq(classes.tutorId, tutorId))
    .orderBy(asc(classes.name));
  return rows.map((r) => r.name);
}

/**
 * Header context for an open conversation, shared by every role's Messages:
 * who the other person is and which classes connect them to the viewer, plus
 * a profile link where the viewer's portal has one.
 */
export async function getConversationContext(
  viewer: { id: string; role: CoarseRole },
  other: { id: string; role: UserRole },
): Promise<ConversationContext> {
  const otherKind = coarseRole(other.role);
  let students: LinkedStudent[] = [];
  let tutorClasses: string[] = [];

  if (otherKind === "student" || otherKind === "parent") {
    const who = otherKind === "student" ? { studentId: other.id } : { parentId: other.id };
    if (viewer.role === "admin") students = await linkedStudents(who);
    else if (viewer.role === "tutor") students = await linkedStudents({ ...who, tutorId: viewer.id });
  } else if (otherKind === "tutor") {
    if (viewer.role === "admin") tutorClasses = await tutorClassNames(other.id);
    else if (viewer.role === "student")
      students = await linkedStudents({ studentId: viewer.id, tutorId: other.id });
    else if (viewer.role === "parent")
      students = await linkedStudents({ parentId: viewer.id, tutorId: other.id });
  }

  const context = conversationContextLabel({
    viewer: viewer.role,
    other: otherKind,
    students,
    tutorClassNames: tutorClasses,
  });

  if (viewer.role === "admin") {
    return { context, profileHref: `/admin/users/${other.id}`, profileLabel: "View profile" };
  }
  if (viewer.role === "tutor" && students.length > 0) {
    const first = students[0];
    return otherKind === "student"
      ? { context, profileHref: `/tutor/students/${first.id}`, profileLabel: "View profile" }
      : { context, profileHref: `/tutor/students/${first.id}`, profileLabel: `View ${first.firstName}` };
  }
  return { context };
}
