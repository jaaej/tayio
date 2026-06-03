import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { requireRole } from "@/lib/auth";
import { listMyThreads } from "@/lib/dm-queries";
import { ThreadRow } from "@/components/dm/thread-row";

export default async function TutorMessagesPage() {
  const user = await requireRole("tutor");
  const threads = await listMyThreads(user.id);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Messages"
        title="Direct messages"
        sub="Conversations with your students, their parents, and the admin office."
      />
      {threads.length === 0 ? (
        <Card>
          <CardBody>
            <div className="py-4 text-sm text-muted text-center">
              No conversations yet.
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {threads.map((t) => (
              <li key={t.threadId}>
                <ThreadRow thread={t} hrefPrefix="/tutor/messages" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
