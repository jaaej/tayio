import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { StudentContacts } from "@/components/student/contacts";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";
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

      <StudentContacts tutors={tutors} admin={adminContact} />

      {threads.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-sm text-muted">
              No conversations yet. Start one from a contact card.
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {threads.map((t) => (
              <li key={t.threadId}>
                <ThreadRow thread={t} hrefPrefix="/student/messages" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
