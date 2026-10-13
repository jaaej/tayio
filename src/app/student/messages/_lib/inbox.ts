import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, subjects } from "@/db/schema";
import type { DmGroup } from "@/components/dm/inbox-compose";
import { listMyThreads } from "@/lib/dm-queries";
import {
  getAdminContactForStudent,
  getStudentTutors,
} from "../../_lib/queries";

/**
 * Thread list and "New message" contacts for the student messaging pane.
 * Only unrestricted students can start a conversation with the admin office.
 */
export async function loadStudentMessagesInbox(
  userId: string,
  isUnrestricted: boolean,
) {
  const [threads, tutors, adminContact] = await Promise.all([
    listMyThreads(userId),
    getStudentTutors(userId),
    isUnrestricted ? getAdminContactForStudent() : Promise.resolve(null),
  ]);

  const groups: DmGroup[] = [
    {
      label: "Tutors",
      contacts: tutors.map((t) => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`.trim(),
        meta: t.subjects.join(" · "),
      })),
    },
  ];
  if (adminContact) {
    groups.push({
      label: "Admin office",
      contacts: [
        {
          id: adminContact.id,
          name: `${adminContact.firstName} ${adminContact.lastName}`.trim(),
          meta: "Billing, enrolment & general questions",
          office: true,
        },
      ],
    });
  }

  return { threads, groups };
}

/**
 * The subject a tutor teaches this student, as a link for the conversation
 * header ("Year 9 Maths" opens that subject). Only when they share exactly
 * one subject, so the link is never a guess.
 */
export async function tutorSubjectLink(
  studentId: string,
  tutorId: string,
): Promise<{ href: string; label: string } | null> {
  const rows = await db
    .selectDistinct({ id: subjects.id, name: subjects.name })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
        eq(classes.tutorId, tutorId),
      ),
    )
    .orderBy(asc(subjects.name));
  if (rows.length !== 1) return null;
  return { href: `/student/subjects/${rows[0].id}`, label: rows[0].name };
}
