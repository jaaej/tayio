import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";

export default async function StudentMessagesPage() {
  const user = await requireRole("student");
  const threads = await listMyThreads(user.id);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Messages"
        title="Inbox"
        sub="Conversations with your tutors and the admin office."
      />
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
