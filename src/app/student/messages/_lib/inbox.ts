import "server-only";
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
