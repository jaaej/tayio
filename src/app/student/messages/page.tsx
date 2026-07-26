import { PageHead } from "@/components/student/page-head";
import { InboxCompose, type DmGroup } from "@/components/dm/inbox-compose";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { getAdminContactForStudent, getStudentTutors } from "../_lib/queries";

export default async function StudentMessagesPage() {
  const user = await requireRole("student");
  const isUnrestricted =
    (user.app_metadata?.role as string | undefined) === "student_unrestricted";
  const [threads, tutors, adminContact] = await Promise.all([
    listMyThreads(user.id),
    getStudentTutors(user.id),
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

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Messages"
        title="Inbox"
        sub={
          isUnrestricted
            ? "Conversations with your tutors and the admin office."
            : "Conversations with your tutors."
        }
      />
      <InboxCompose
        threads={threads}
        hrefPrefix="/student/messages"
        groups={groups}
      />
    </div>
  );
}
